import { expect, test, type Page } from '@playwright/test'

import { expectClaim, expectVerdict } from './expect-verdict.js'

/**
 * One test per rendered verdict, asserting what the page SAYS and the state it
 * renders in the same breath.
 *
 * Every test here is named by at least one entry in e2e/verdict-mutations.json
 * as the assertion that kills a recorded mutation, and e2e/global-teardown.ts
 * fails the run if an assertion a record names never actually executed. So the
 * titles below are load-bearing: changing one without changing the registry
 * fails the suite rather than quietly un-covering a marker.
 */

async function runExchange(page: Page): Promise<void> {
  await page.locator('#exchange-button').click()
  await expect(page.locator('#exchange-output')).toBeVisible()
}

async function openWorking(page: Page): Promise<void> {
  await page.locator('#working-details summary').click()
  await expect(page.locator('#working-details')).toHaveAttribute('open', '')
}

/** Alice's own private value, read off the page's own disclosure. */
async function alicePrivateValue(page: Page): Promise<string> {
  return (
    await page
      .locator('#working-output .working-row')
      .filter({ hasText: 'Alice’s private value' })
      .locator('code')
      .innerText()
  ).trim()
}

async function guessWith(page: Page, value: string): Promise<void> {
  await page.locator('#candidate-input').fill(value)
  await page.locator('#try-button').click()
  await expect(page.locator('[data-verdict="guess-outcome"]')).toHaveCount(1)
}

test.beforeEach(async ({ page }) => {
  await page.goto('./')
  await expect(page.locator('#app')).not.toBeEmpty()
})

test('spec-vectors reports the measured check against the RFC 7748 vectors', async ({ page }) => {
  // Runs at mount, before anything is pressed: the page's claim to be using
  // the real function is a result on arrival rather than a promise.
  await expectVerdict(page, 'spec-vectors', {
    contains: 'MATCHES THE PUBLISHED EXAMPLES',
    result: 'pass',
  })
})

test('shared-secret-match renders the measured comparison of the two sides', async ({ page }) => {
  await runExchange(page)
  await expectVerdict(page, 'shared-secret-match', {
    contains: 'THE SAME 32 BYTES',
    absent: 'NOT THE SAME BYTES',
    result: 'pass',
  })
})

test('zero-check reports the RFC 7748 section 6.1 check on the live exchange', async ({ page }) => {
  await runExchange(page)
  await openWorking(page)
  await expectVerdict(page, 'zero-check', {
    contains: 'NOT THE ALL-ZERO VALUE',
    absent: 'ABORT',
    result: 'pass',
  })
})

test('guess-outcome renders the byte comparison of a guess against the real secret', async ({
  page,
}) => {
  await runExchange(page)
  await page.locator('#roll-button').click()
  await expect(page.locator('#candidate-input')).toHaveValue(/^[0-9a-f]{64}$/)
  await page.locator('#try-button').click()
  await expectVerdict(page, 'guess-outcome', {
    contains: 'NOT THE SAME BYTES',
    result: 'pass',
  })
})

test('recovery-status reports no recovery, and counts the attempt', async ({ page }) => {
  await runExchange(page)
  await page.locator('#roll-button').click()
  await page.locator('#try-button').click()
  await expectVerdict(page, 'recovery-status', {
    contains: 'SHARED SECRET NOT RECOVERED',
    result: 'pass',
  })
  // The count is a measurement of this run like any other, so it is held to
  // the rendered text AND the machine value at once.
  await expectClaim(page, 'guess-count', { contains: '1 guess', value: '1' })
})

test('guess-outcome and recovery-status both turn over for the one value that works', async ({
  page,
}) => {
  // The positive control for the whole eavesdropper panel. If neither verdict
  // could ever report recovery, the panel would be theatre: it would print
  // "NOT RECOVERED" against anything, including the right answer.
  await runExchange(page)
  await openWorking(page)
  await guessWith(page, await alicePrivateValue(page))
  await expectVerdict(page, 'guess-outcome', { contains: 'THE SAME 32 BYTES', result: 'alarm' })
  await expectVerdict(page, 'recovery-status', {
    contains: 'SHARED SECRET RECOVERED',
    result: 'alarm',
  })
})

test('identity-status renders the substituted exchange as a match', async ({ page }) => {
  await page.locator('#impostor-button').click()
  await expect(page.locator('#identity-output')).toBeVisible()
  await expectVerdict(page, 'identity-status', {
    contains: 'THE SAME 32 BYTES — AND YOU DO NOT KNOW WHO WITH',
    result: 'pass',
  })
})
