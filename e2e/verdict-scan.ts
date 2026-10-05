import type { Page } from '@playwright/test'

/**
 * Coverage is derived from the RENDERED PAGE, never from a list written by
 * hand. "The verdicts this lab has" written in a file is a self-report; the DOM
 * is evidence. Three rules are enforced across every state the walk reaches:
 *
 *   1. every element that renders an outcome carries `data-verdict="<id>"`, and
 *      every id found that way is covered by a recorded mutation;
 *   2. every number this page reports about a RUN sits in `data-claim="<id>"`,
 *      on the same terms — a rendered number is a claim exactly as a rendered
 *      word is, and it is the easier one to leave unmarked because a number
 *      does not look like a claim;
 *   3. nothing renders verdict words or verdict styling outside a marker, which
 *      is what catches a careless builder dropping a raw banner in later.
 */

/**
 * Shouty outcome words, matched only in ALL CAPS and only as whole words. This
 * list is scoped to the outcomes THIS lab can render plus the ones a careless
 * addition would most likely reach for; a word the page never says costs
 * nothing to guard, and a word it says in prose would turn the rule off.
 */
export const VERDICT_WORDS = [
  'ABORT',
  'ABORTED',
  'ACCEPTED',
  'BROKEN',
  'DIFFERENT',
  'FAIL',
  'FAILED',
  'FAILURE',
  'IDENTICAL',
  'INVALID',
  'MATCH',
  'MATCHED',
  'MATCHES',
  'MISMATCH',
  'PASS',
  'PASSED',
  'RECOVERED',
  'REJECTED',
  'SAFE',
  'SAME',
  'SECURE',
  'SUCCESS',
  'UNSAFE',
  'VALID',
  'VERDICT',
  'VERIFIED',
] as const

/**
 * Anything that paints an outcome: the verdict block itself and the state hooks
 * a stylesheet could colour from. `[data-outcome]` and `[data-state]` are in
 * this list even though this lab uses neither, so that a second state hook
 * cannot arrive unmarked later — which is exactly how one escaped elsewhere in
 * the fleet, painting a whole card pass while the marker inside it said alarm.
 */
export const VERDICT_STYLE_SELECTOR =
  '[class*="verdict"], [data-result], [data-state], [data-outcome]'

/**
 * Where this page reports on a run.
 *
 * Scoped to the run-reporting regions rather than the whole document on
 * purpose: prose, spec citations and section references ("RFC 7748", "§5.2")
 * are not measurements of this run, and a rule that flagged them would be
 * turned off within a week. The eavesdropper's NOTICES are deliberately outside
 * #eavesdrop-output for the same reason — "you gave 12 characters" measures
 * what the reader typed, not what the cryptography did.
 */
export const RESULT_REGION_SELECTOR = [
  '#vector-check',
  '#exchange-output',
  '#working-output',
  '#eavesdrop-output',
  '#identity-output',
].join(', ')

/**
 * digit-plus-unit, and a bare short integer standing alone in a stats list.
 *
 * The leading `(?<![\w.])` is load-bearing: without it a hex blob containing
 * `12b` reads as "12 bytes" and the rule flakes on random key material, which
 * this page renders a great deal of.
 */
export const MEASUREMENT_PATTERN =
  /(?<![\w.])\d[\d,]*(?:\.\d+)?\s*(?:B|KB|MB|bits?|bytes?|chars?|characters?|digits?|guess|guesses|ops?|ms|s|×|x)\b/i

/** A short integer standing alone — "6", "42", "1,568". */
export const BARE_INTEGER_PATTERN = /^\d{1,3}(?:,\d{3})*$/

export interface VerdictViolation {
  state: string
  kind: 'word' | 'styling' | 'measurement'
  detail: string
  where: string
}

export interface VerdictScan {
  markers: string[]
  claims: string[]
  violations: VerdictViolation[]
}

export async function scanVerdicts(page: Page, state: string): Promise<VerdictScan> {
  return page.evaluate(
    ([stateLabel, words, styleSelector, regionSelector, measurementSource, bareIntegerSource]) => {
      const describe = (element: Element): string => {
        const id = element.id ? `#${element.id}` : ''
        const cls =
          element.className && typeof element.className === 'string'
            ? `.${element.className.trim().split(/\s+/).join('.')}`
            : ''
        return `${element.tagName.toLowerCase()}${id}${cls}`
      }

      const isVisible = (element: Element): boolean =>
        (element as HTMLElement).getClientRects().length > 0

      const markers = [
        ...new Set(
          [...document.querySelectorAll('[data-verdict]')].map(
            (element) => (element as HTMLElement).dataset.verdict ?? '',
          ),
        ),
      ].filter(Boolean)

      const claims = [
        ...new Set(
          [...document.querySelectorAll('[data-claim]')].map(
            (element) => (element as HTMLElement).dataset.claim ?? '',
          ),
        ),
      ].filter(Boolean)

      const violations: Array<{
        state: string
        kind: 'word' | 'styling' | 'measurement'
        detail: string
        where: string
      }> = []

      for (const element of document.querySelectorAll(styleSelector)) {
        if (element.closest('[data-verdict]')) continue
        if (!isVisible(element)) continue
        violations.push({
          state: stateLabel,
          kind: 'styling',
          detail: describe(element),
          where: describe(element.parentElement ?? element),
        })
      }

      const pattern = new RegExp(`(?<![A-Z])(${words.join('|')})(?![A-Z])`, 'g')
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const owner = node.parentElement
        if (!owner) continue
        if (owner.closest('[data-verdict]')) continue
        if (!isVisible(owner)) continue
        const text = node.textContent ?? ''
        for (const hit of [...new Set([...text.matchAll(pattern)].map((match) => match[1]))]) {
          violations.push({
            state: stateLabel,
            kind: 'word',
            detail: hit,
            where: `${describe(owner)} :: ${text.trim().slice(0, 80)}`,
          })
        }
      }

      // Leaf text only: a container's text is the concatenation of its
      // children, and would report the same number a second time.
      const measurement = new RegExp(measurementSource, 'i')
      const bareInteger = new RegExp(bareIntegerSource)
      for (const region of document.querySelectorAll(regionSelector)) {
        const leaves = [region, ...region.querySelectorAll('*')].filter(
          (element) => element.children.length === 0,
        )
        for (const leaf of leaves) {
          if (leaf.closest('[data-verdict]') || leaf.closest('[data-claim]')) continue
          if (!isVisible(leaf)) continue
          const text = (leaf.textContent ?? '').trim()
          if (!text) continue
          const inStatsList = Boolean(leaf.closest('dl')) && leaf.tagName === 'DD'
          const hit =
            text.match(measurement)?.[0] ?? (inStatsList && bareInteger.test(text) ? text : '')
          if (!hit) continue
          violations.push({
            state: stateLabel,
            kind: 'measurement',
            detail: hit.trim(),
            where: `${describe(leaf)} :: ${text.slice(0, 80)}`,
          })
        }
      }

      return { markers, claims, violations }
    },
    [
      state,
      VERDICT_WORDS as unknown as string[],
      VERDICT_STYLE_SELECTOR,
      RESULT_REGION_SELECTOR,
      MEASUREMENT_PATTERN.source,
      BARE_INTEGER_PATTERN.source,
    ] as const,
  )
}
