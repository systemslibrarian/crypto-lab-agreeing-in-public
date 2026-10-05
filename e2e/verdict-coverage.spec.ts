import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { expect, test, type Page } from '@playwright/test'

import { driveEveryState } from './drive-every-state.js'
import { scanVerdicts, type VerdictViolation } from './verdict-scan.js'

interface MutationEntry {
  file: string
  find: string
  replace: string
  /** marker id -> the test title and the exact claim that kills it. */
  kills: Record<string, { test: string; claim: Record<string, unknown> }>
  why: string
}

const repoRoot = fileURLToPath(new URL('../', import.meta.url))
const registry = JSON.parse(
  readFileSync(new URL('./verdict-mutations.json', import.meta.url), 'utf8'),
) as { mutations: Record<string, MutationEntry> }

const mutations = Object.entries(registry.mutations)
// The covered set IS the set of recorded kills. A separate `covers:` list
// beside them could disagree with them; this cannot.
const coveredIds = new Set(mutations.flatMap(([, entry]) => Object.keys(entry.kills ?? {})))

async function driveAndScan(page: Page): Promise<{
  markers: Set<string>
  claims: Set<string>
  violations: VerdictViolation[]
}> {
  const markers = new Set<string>()
  const claims = new Set<string>()
  const violations: VerdictViolation[] = []
  await driveEveryState(page, async (state) => {
    const scan = await scanVerdicts(page, state)
    scan.markers.forEach((marker) => markers.add(marker))
    scan.claims.forEach((claim) => claims.add(claim))
    violations.push(...scan.violations)
  })
  return { markers, claims, violations }
}

test.beforeEach(async ({ page }) => {
  await page.goto('./')
  await expect(page.locator('#app')).not.toBeEmpty()
})

test('check 1: every verdict and every measurement the page renders has a recorded mutation', async ({
  page,
}) => {
  test.setTimeout(180_000)
  const { markers, claims } = await driveAndScan(page)

  expect(markers.size, 'the page must render at least one marked verdict').toBeGreaterThan(0)
  expect(claims.size, 'the page must render at least one marked measurement').toBeGreaterThan(0)

  // data-claim markers are in this loop on the same terms as data-verdict
  // ones. Enforcing the rule over only one of the two families is how a newly
  // rendered measurement ships with no mutation and nothing goes red.
  const rendered = new Set([...markers, ...claims])
  const uncovered = [...rendered].filter((id) => !coveredIds.has(id)).sort()
  expect(
    uncovered,
    'markers rendered by the page with no mutation in e2e/verdict-mutations.json',
  ).toEqual([])

  const unrendered = [...coveredIds].filter((id) => !rendered.has(id)).sort()
  expect(unrendered, 'mutations claiming to cover a marker this page never renders').toEqual([])
})

test('check 2: no verdict word, verdict styling or measurement renders outside a marker', async ({
  page,
}) => {
  test.setTimeout(180_000)
  const { violations } = await driveAndScan(page)
  const unique = [
    ...new Map(
      violations.map((violation) => [
        `${violation.kind}:${violation.detail}:${violation.where}`,
        violation,
      ]),
    ).values(),
  ]
  expect(unique, 'outcomes rendered outside any data-verdict marker').toEqual([])
})

test('check 2 fails the careless builder: a raw banner and a raw number are both caught', async ({
  page,
}) => {
  // The rule above is only worth what it catches, so this adds the banner the
  // way somebody would who was not thinking about this lane at all -- shouty,
  // styled, unmarked. If the scanner stays quiet here, check 2 is decoration.
  const clean = await scanVerdicts(page, 'before injection')
  expect(clean.violations, 'the baseline must be clean before the injection').toEqual([])

  await page.evaluate(() => {
    const banner = document.createElement('div')
    banner.id = 'careless-banner'
    banner.className = 'verdict'
    banner.innerHTML = '<strong>ALL CHECKS PASSED — SECRET VERIFIED</strong>'
    document.querySelector('.shell')?.prepend(banner)
  })
  const dirty = await scanVerdicts(page, 'raw unmarked banner')
  expect(dirty.violations.some((violation) => violation.kind === 'styling')).toBe(true)
  expect(dirty.violations.some((violation) => violation.kind === 'word')).toBe(true)
  expect(dirty.violations.map((violation) => violation.detail)).toEqual(
    expect.arrayContaining(['PASSED', 'VERIFIED']),
  )

  await page.evaluate(() => document.querySelector('#careless-banner')?.remove())
  expect((await scanVerdicts(page, 'after removal')).violations).toEqual([])

  // A measurement carries no verdict word and no verdict styling, so neither
  // rule above sees it. That is why the third rule exists.
  await page.locator('#exchange-button').click()
  await expect(page.locator('#exchange-output')).toBeVisible()
  await page.evaluate(() => {
    const row = document.createElement('p')
    row.id = 'careless-metric'
    row.textContent = 'Derived in 12 ms'
    document.querySelector('#exchange-output')?.append(row)
  })
  const numeric = await scanVerdicts(page, 'raw unmarked measurement')
  expect(
    numeric.violations.some((violation) => violation.kind === 'measurement'),
    'a digit-plus-unit measurement outside a marker must be reported',
  ).toBe(true)

  await page.evaluate(() => document.querySelector('#careless-metric')?.remove())
  expect((await scanVerdicts(page, 'after measurement removal')).violations).toEqual([])

  // A bare state hook: no verdict word, no verdict class, no number -- just an
  // attribute a stylesheet could paint an outcome from.
  await page.evaluate(() => {
    const hook = document.createElement('div')
    hook.id = 'careless-hook'
    hook.dataset.outcome = 'pass'
    hook.textContent = 'Comparison'
    document.querySelector('.shell')?.prepend(hook)
  })
  const hooked = await scanVerdicts(page, 'raw unmarked state hook')
  expect(
    hooked.violations.some(
      (violation) => violation.kind === 'styling' && violation.detail === 'div#careless-hook',
    ),
    'a state hook painting an outcome outside a marker must be reported',
  ).toBe(true)

  await page.evaluate(() => document.querySelector('#careless-hook')?.remove())
  expect((await scanVerdicts(page, 'after state hook removal')).violations).toEqual([])
})

test('every recorded mutation still applies to the source it names', async () => {
  // A mutation whose `find` no longer matches guards nothing, and would let a
  // marker drift back to a constant with this gate still green.
  const rotted: string[] = []
  for (const [id, entry] of mutations) {
    const source = readFileSync(new URL(entry.file, `file://${repoRoot}`), 'utf8')
    const occurrences = source.split(entry.find).length - 1
    if (occurrences !== 1) rotted.push(`${id}: ${entry.file} matched ${occurrences}x, want 1`)
    if (!Object.keys(entry.kills ?? {}).length) rotted.push(`${id}: records no kill`)
  }
  expect(rotted, 'mutations in e2e/verdict-mutations.json that no longer apply').toEqual([])
})
