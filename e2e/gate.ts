import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

import { auditContrast, formatContrastFailures } from './contrast.js'
import { auditNonText } from './nontext.js'
import { NONTEXT_BASELINE } from './nontext-baseline.js'

/** The three widths this lab is authored to. */
export const DESKTOP = { width: 1280, height: 900 }
export const PHONE = { width: 390, height: 844 }
export const NARROWEST = { width: 320, height: 800 }

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

/**
 * Shared machinery for the WCAG 2.1 A/AA gate.
 *
 * Four rules govern it, and each corrects a way the retired template gate
 * reported coverage it did not have:
 *
 *  1. NOTHING IS INJECTED INTO THE PAGE BEFORE A SCAN. The old gate pushed
 *     `animation:none!important` through `addStyleTag`, which BYPASSES this
 *     lab's own `@media (prefers-reduced-motion: reduce)` block instead of
 *     exercising it — so the rendering a reduced-motion reader actually gets
 *     was never the one scanned. `boot()` sets the preference through
 *     `emulateMedia` BEFORE navigation and then asserts from inside the page
 *     that it took effect, because both `test.use({ reducedMotion })` and the
 *     config key are measured no-ops on Playwright 1.6x.
 *  2. NO PANEL IS REVEALED FROM SCRIPT. Stripping `[hidden]` and opening every
 *     `<details>` by JS scans states no reader can reach, and simultaneously
 *     destroys the ability to catch the `[hidden]` cascade trap. Every state
 *     below is reached by clicking the control a reader would click, and the
 *     shut state is scanned too.
 *  3. THE DEFAULTS ARE ASSERTED BEFORE ANYTHING IS SCANNED, so an empty or
 *     half-built render cannot pass by having nothing to find.
 *  4. `violations` IS NOT THE WHOLE ORACLE. axe's `incomplete` bucket is where
 *     every contrast decision it declined to make ends up, so that is asserted
 *     too, and text contrast is computed arithmetically alongside it.
 *
 * `boot()` asserts STRUCTURE and never product copy (§4.1a). A sentence this
 * lab renders belongs in `claims.spec.ts`, where a failure names copy as the
 * subject — not here, where one string would fail every accessibility test at
 * once under a heading naming the wrong thing.
 */
export function watchPageErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  return errors
}

export async function boot(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' })
  await page.goto('./')

  // Structure, counts and shapes — never what a string says.
  await expect(page.locator('#app')).not.toBeEmpty()
  await expect(page.locator('h1')).toHaveCount(1)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('[role="banner"]')).toHaveCount(1)
  // No theme control: the fleet had one and it was removed.
  await expect(page.locator('[aria-label*="theme" i]')).toHaveCount(0)
  await expect(page.locator('select')).toHaveCount(0)
  // The lab arrives with its outputs unrendered and its disclosure shut.
  await expect(page.locator('#exchange-output')).toBeHidden()
  await expect(page.locator('#identity-output')).toBeHidden()
  await expect(page.locator('#working-details')).toHaveCount(0)
  // The leak and equivalents disclosures exist at arrival but are shut: a
  // reader must operate them, and a private value is never on screen until
  // they do.
  await expect(page.locator('#leak-details')).toHaveCount(0)
  await expect(page.locator('#equivalents-details')).toHaveCount(1)
  await expect(page.locator('details[open]')).toHaveCount(0)
  await expect(page.locator('#candidate-input')).toBeDisabled()
  await expect(page.locator('#candidate-input')).toHaveAttribute('maxlength', '64')
  // The skip link's target has to exist, or the link is decoration.
  await expect(page.locator('.skip-link')).toHaveAttribute('href', '#app')
  await expect(page.locator('#app')).toHaveCount(1)

  expect(
    await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
    'emulateMedia must actually reach the page, or rule 1 is unenforced',
  ).toBe(true)
}

export async function scan(page: Page, label: string): Promise<void> {
  await expect(page.locator('.cl-hero-title')).toBeVisible()

  // Two analyze() calls, merged. NEVER chained: .withTags().withRules() both
  // write options.runOnly, so the second silently REPLACES the first and axe
  // runs four best-practice rules and zero WCAG rules while reading as a pass.
  const wcag = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  const landmarks = await new AxeBuilder({ page })
    .withRules([
      'landmark-no-duplicate-banner',
      'landmark-unique',
      'landmark-one-main',
      'landmark-complementary-is-top-level',
    ])
    .analyze()

  const violations = [...wcag.violations, ...landmarks.violations].map((violation) => ({
    state: label,
    id: violation.id,
    nodes: violation.nodes.map((node) => node.target.join(' ')).slice(0, 8),
  }))
  expect(violations, `axe violations in ${label}`).toEqual([])

  // color-contrast is excluded here only because it is computed arithmetically
  // below, which is strictly more than axe would have done: axe parks every
  // contrast decision it declined over a gradient or an unresolved color-mix()
  // in this bucket and reports nothing.
  const incomplete = [...wcag.incomplete, ...landmarks.incomplete]
    .filter((result) => result.id !== 'color-contrast')
    .map((result) => ({
      state: label,
      id: result.id,
      nodes: result.nodes.map((node) => node.target.join(' ')).slice(0, 8),
    }))
  expect(incomplete, `unexplained axe incomplete results in ${label}`).toEqual([])

  const contrast = [...new Set(formatContrastFailures(await auditContrast(page)))]
  expect(contrast, `measured text contrast in ${label}`).toEqual([])

  // Text inside aria-hidden still has to pass: this lab's verdict icons live
  // there, and a glyph nobody can read is not an improvement on colour alone.
  const hiddenContrast = [
    ...new Set(
      formatContrastFailures(
        await auditContrast(page, '[aria-hidden="true"], [aria-hidden="true"] *', true),
      ),
    ),
  ]
  expect(hiddenContrast, `measured aria-hidden contrast in ${label}`).toEqual([])

  const nonText = await auditNonText(page)
  expect(Object.keys(NONTEXT_BASELINE), 'the non-text baseline must stay empty').toEqual([])
  expect(nonText, `non-text contrast in ${label}`).toEqual([])

  const scrollers = await page.locator('*').evaluateAll((elements) =>
    elements
      .filter((element) =>
        /auto|scroll/.test(
          getComputedStyle(element).overflowX + getComputedStyle(element).overflowY,
        ),
      )
      .filter(
        (element) =>
          element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight,
      )
      .map((element) => ({
        tag: element.tagName,
        tabindex: element.getAttribute('tabindex'),
        name: element.getAttribute('aria-label'),
        role: element.getAttribute('role'),
      })),
  )
  expect(
    scrollers.filter((item) => item.tabindex !== '0' || !item.name || !item.role),
    `scrollable regions a keyboard cannot reach in ${label}`,
  ).toEqual([])

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, `horizontal page overflow in ${label} (WCAG 1.4.10)`).toBeLessThanOrEqual(1)
}

/**
 * Every state a reader can reach, scanned as it renders.
 *
 * Controls on this page, and what each owes the walk:
 *
 * | Control | States visited |
 * |---|---|
 * | `#analogy-step` | all four stages, plus the fifth press that wraps to stage one |
 * | `#exchange-button` | before the first press, after it, and after a SECOND press (fresh exchange) |
 * | `#working-details` | shut, then opened through its own summary |
 * | `#leak-details` | shut at arrival, opened through its own summary |
 * | `#equivalents-details` | shut at arrival, opened with the rest |
 * | `#roll-button` | its one press |
 * | `#try-button` | a rolled guess, a non-hex value, a short value |
 * | `#candidate-input` | disabled at arrival, enabled after the exchange, edited to retire a standing attempt |
 * | `#impostor-button` | its first press and its second |
 * | `.skip-link` | focused |
 */
export async function driveAllStates(page: Page, prefix: string): Promise<void> {
  const scanAt = (state: string) => scan(page, `${prefix} / ${state}`)

  await scanAt('arrival, nothing run')

  await page.keyboard.press('Tab')
  await expect(page.locator('.skip-link')).toBeFocused()
  await scanAt('skip link focused')

  // The analogy: four stages on demand, then the wrap.
  for (let stage = 2; stage <= 4; stage += 1) {
    await page.locator('#analogy-step').click()
    // data-stage, not the progress sentence: §4.1a wants structure here, so
    // that rewording "Step 2 of 4" fails a claims test rather than every
    // accessibility test at once, under a heading naming the wrong subject.
    await expect(page.locator('.analogy-board')).toHaveAttribute('data-stage', String(stage - 1))
    await scanAt(`analogy stage ${stage}`)
  }
  await page.locator('#analogy-step').click()
  await expect(page.locator('.analogy-board')).toHaveAttribute('data-stage', '0')
  await scanAt('analogy wrapped back to stage one')

  await page.locator('#exchange-button').click()
  await expect(page.locator('#exchange-output')).toBeVisible()
  await expect(page.locator('[data-verdict="shared-secret-match"]')).toHaveCount(1)
  await scanAt('exchange run')

  await page.locator('#working-details summary').click()
  await expect(page.locator('#working-details')).toHaveAttribute('open', '')
  await scanAt('working disclosure open')

  await page.locator('#leak-details summary').click()
  await expect(page.locator('#leak-details')).toHaveAttribute('open', '')
  await scanAt('leak disclosure opened')

  await page.locator('#roll-button').click()
  await expect(page.locator('#candidate-input')).toHaveValue(/^[0-9a-f]{64}$/)
  await scanAt('a guess rolled but not run')

  await page.locator('#try-button').click()
  await expect(page.locator('[data-verdict="guess-outcome"]')).toHaveCount(1)
  await scanAt('guess run and refused')

  // Editing the value retires the standing attempt.
  await page.locator('#candidate-input').fill('00')
  await expect(page.locator('#retired-note')).toBeVisible()
  await scanAt('standing attempt retired by an edit')

  await page.locator('#try-button').click()
  await expect(page.locator('#invalid-note')).toBeVisible()
  await scanAt('a value too short to run')

  await page.locator('#candidate-input').fill('nothex')
  await page.locator('#try-button').click()
  await expect(page.locator('#invalid-note')).toBeVisible()
  await scanAt('a value that is not hex')

  // A fresh exchange retires an attempt made against the previous secret.
  await page.locator('#roll-button').click()
  await page.locator('#try-button').click()
  await expect(page.locator('[data-verdict="guess-outcome"]')).toHaveCount(1)
  await page.locator('#exchange-button').click()
  await expect(page.locator('#retired-note')).toBeVisible()
  await scanAt('fresh exchange retires the previous attempt')

  await page.locator('#impostor-button').click()
  await expect(page.locator('#identity-output')).toBeVisible()
  await expect(page.locator('[data-verdict="negative-claim"]')).toBeVisible()
  await scanAt('negative-claim fixture reached')

  await page.locator('#impostor-button').click()
  await expect(page.locator('[data-verdict="identity-status"]')).toHaveCount(1)
  await scanAt('negative-claim fixture run a second time')

  for (const summary of await page.locator('summary').all()) {
    if (!(await summary.evaluate((node) => (node.parentElement as HTMLDetailsElement).open))) {
      await summary.click()
    }
  }
  await scanAt('every disclosure open')
}
