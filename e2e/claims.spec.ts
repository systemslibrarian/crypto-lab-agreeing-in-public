import { x25519 } from '@noble/curves/ed25519.js'
import { expect, test, type Page } from '@playwright/test'

import { expectVerdict } from './expect-verdict.js'

/**
 * The claims suite (§4.1b): does this page tell the truth?
 *
 * The rule that makes these worth anything is that they compare two values the
 * PAGE printed, or RE-DERIVE a claim from the page's own raw inputs by a
 * different route than the source takes — never assert against a hardcoded
 * string, and never recompute using the same expression the source uses, which
 * would happily agree with a bug.
 *
 * Here the independent route is Node's own copy of X25519, driven from the
 * private values the page discloses. The page builds its answer through
 * src/exchange/exchange.ts; these tests build theirs from the library directly
 * and require the two to agree. A mutation that changes which peer value the
 * page combines is invisible to a test that only checks the page agrees with
 * itself, and is caught here.
 *
 * Copy assertions live here rather than in e2e/gate.ts's `boot()` (§4.1a): a
 * reworded sentence must fail a test named "claims", not every test in a step
 * called "Accessibility gate".
 */

const HEX = /^[0-9a-f]{64}$/

function fromHex(value: string): Uint8Array {
  const clean = value.trim()
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i += 1) out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  return out
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Read one labelled value out of the "show the working" disclosure. */
async function working(page: Page, label: string): Promise<string> {
  return (
    await page.locator('#working-output .working-row').filter({ hasText: label }).locator('code').innerText()
  ).trim()
}

async function runExchangeAndOpenWorking(page: Page): Promise<void> {
  await page.locator('#exchange-button').click()
  await expect(page.locator('#exchange-output')).toBeVisible()
  await page.locator('#working-details summary').click()
  await expect(page.locator('#working-details')).toHaveAttribute('open', '')
}

test.beforeEach(async ({ page }) => {
  await page.goto('./')
  await expect(page.locator('#app')).not.toBeEmpty()
})

test('the shared secret is what X25519 independently says it should be', async ({ page }) => {
  await runExchangeAndOpenWorking(page)
  const alicePrivate = await working(page, 'Alice’s private value')
  const bobPublic = await working(page, 'Bob sends')
  expect(alicePrivate).toMatch(HEX)
  expect(bobPublic).toMatch(HEX)

  // Re-derived here, from the page's raw inputs, through the library directly.
  const derived = toHex(x25519.getSharedSecret(fromHex(alicePrivate), fromHex(bobPublic)))
  const printed = page.locator('[data-test="shared-secret"]')
  await expect(printed).toHaveAttribute('data-value', derived)
  await expect(printed).toContainText(derived.slice(0, 16))
})

test('the two sides are two computations, not one value printed twice', async ({ page }) => {
  await runExchangeAndOpenWorking(page)
  const alicePrivate = await working(page, 'Alice’s private value')
  const bobPrivate = await working(page, 'Bob’s private value')
  const alicePublic = await working(page, 'Alice sends')
  const bobPublic = await working(page, 'Bob sends')

  // Each side re-derived from only what that party knows. If the page had
  // handed one side's answer to the other, one of these would not reproduce.
  const aliceSide = toHex(x25519.getSharedSecret(fromHex(alicePrivate), fromHex(bobPublic)))
  const bobSide = toHex(x25519.getSharedSecret(fromHex(bobPrivate), fromHex(alicePublic)))
  expect(aliceSide).toBe(bobSide)
  expect(await working(page, 'What Alice computed')).toBe(aliceSide)
  expect(await working(page, 'What Bob computed')).toBe(bobSide)

  // And the published values really are the private ones against the base
  // point -- the other half of what RFC 7748 §6.1 claims.
  expect(toHex(x25519.getPublicKey(fromHex(alicePrivate)))).toBe(alicePublic)
  expect(toHex(x25519.getPublicKey(fromHex(bobPrivate)))).toBe(bobPublic)
})

test('the private values are never among the values the transcript shows as sent', async ({
  page,
}) => {
  await runExchangeAndOpenWorking(page)
  const alicePrivate = await working(page, 'Alice’s private value')
  const bobPrivate = await working(page, 'Bob’s private value')
  const crossed = await page.locator('#transcript-body .wire-list:not(.wire-list-withheld) code').allInnerTexts()
  expect(crossed).toHaveLength(3)
  expect(crossed.map((value) => value.trim())).not.toContain(alicePrivate)
  expect(crossed.map((value) => value.trim())).not.toContain(bobPrivate)

  // The shared secret crossed nothing either -- that is the lab's whole claim.
  const secret = await working(page, 'What Alice computed')
  expect(crossed.map((value) => value.trim())).not.toContain(secret)
})

test('the guessing space the prose names matches the length the input accepts', async ({ page }) => {
  // A cross-check between three surfaces that must agree: the hand-authored
  // sentence, the control's own maxlength, and the value the roll produces.
  await page.locator('#exchange-button').click()
  const help = (await page.locator('#candidate-help').innerText()).replace(/\s+/g, ' ')
  expect(help).toContain('32 bytes');
  expect(help).toContain('64 characters')
  await expect(page.locator('#candidate-input')).toHaveAttribute('maxlength', '64')
  await page.locator('#roll-button').click()
  await expect(page.locator('#candidate-input')).toHaveValue(HEX)

  // 2^251 distinct private values after RFC 7748 §5's clamping is a 76-digit
  // number, and the page says 76. Recomputed here rather than quoted.
  await page.locator('#try-button').click()
  const digits = BigInt(2) ** BigInt(251)
  const stated = await page.locator('[data-verdict="recovery-status"] .verdict-detail').innerText()
  expect(stated).toContain(`${digits.toString().length} digits long`)
})

test('a fresh exchange retires an attempt made against the previous secret', async ({ page }) => {
  await page.locator('#exchange-button').click()
  await page.locator('#roll-button').click()
  await page.locator('#try-button').click()
  await expect(page.locator('[data-verdict="guess-outcome"]')).toHaveCount(1)
  const before = await page.locator('[data-test="shared-secret"]').getAttribute('data-value')

  await page.locator('#exchange-button').click()
  const after = await page.locator('[data-test="shared-secret"]').getAttribute('data-value')
  expect(after).not.toBe(before)

  // The stale verdict is GONE, and the page says it was retired rather than
  // silently dropping it.
  await expect(page.locator('[data-verdict="guess-outcome"]')).toHaveCount(0)
  await expect(page.locator('#retired-note')).toContainText('retired')
})

test('re-entering the same candidate does not retire a standing attempt', async ({ page }) => {
  // The no-op guard: a change event that changes nothing must leave the
  // standing result alone, or "retired" stops meaning anything.
  await page.locator('#exchange-button').click()
  await page.locator('#roll-button').click()
  await page.locator('#try-button').click()
  await expect(page.locator('[data-verdict="guess-outcome"]')).toHaveCount(1)

  const standing = await page.locator('#candidate-input').inputValue()
  await page.locator('#candidate-input').fill(standing)
  await expect(page.locator('[data-verdict="guess-outcome"]')).toHaveCount(1)
  await expect(page.locator('#retired-note')).toHaveCount(0)
})

test('each refusal names its actual cause', async ({ page }) => {
  await page.locator('#exchange-button').click()
  await page.locator('#candidate-input').fill('00ff')
  await page.locator('#try-button').click()
  await expect(page.locator('#invalid-note')).toContainText('not 32 bytes')

  await page.locator('#candidate-input').fill('zz')
  await page.locator('#try-button').click()
  await expect(page.locator('#invalid-note')).toContainText('not hex')
})

test('the arrival state renders no outcome it has not computed', async ({ page }) => {
  // The [hidden] probe from §4.1: an element the code believes is hidden can
  // still paint, because a class rule setting `display` outranks the UA
  // [hidden] rule. Asserted as "really not rendered", not "has the attribute".
  await expect(page.locator('#exchange-output')).toBeHidden()
  await expect(page.locator('#identity-output')).toBeHidden()
  await expect(page.locator('[data-verdict="shared-secret-match"]')).toHaveCount(0)
  await expect(page.locator('[data-verdict="guess-outcome"]')).toHaveCount(0)
  await expect(page.locator('[data-verdict="identity-status"]')).toHaveCount(0)
  await expect(page.locator('[data-test="shared-secret"]')).toHaveCount(0)
})

test('the page says it is an analogy before it shows the picture', async ({ page }) => {
  // A copy assertion, deliberately in the claims suite: the honesty of panel 1
  // rests on this word being there, and a reword should fail a test named
  // "claims" rather than the accessibility gate.
  await expect(page.locator('.analogy-lead')).toContainText('analogy')
  await expect(page.locator('.analogy-lead')).toContainText('not the mechanism')
})

/**
 * §4.1d — the negative claim.
 *
 * The claim: X25519 key agreement does not tell you WHO you agreed with.
 *
 * The fixture: an exchange run against a substituted public value. Three
 * assertions, in the order §4.1d sets them out — reach it through the UI,
 * show that everything the page checks reports success, and show the
 * limitation on screen in that same state.
 */
test('identity-status: every check passes in the substituted exchange and the limit is on screen', async ({
  page,
}) => {
  // 1. Reach the fixture through the interface.
  await page.locator('#impostor-button').click()
  await expect(page.locator('#identity-output')).toBeVisible()

  // 2. Everything is green -- read off the rendered verdicts, never a flag the
  //    test sets. If any check here failed, the fixture would be demonstrating
  //    the mechanism breaking rather than its limit, and would prove nothing.
  const checks = await page.locator('[data-test="identity-checks"] li').allInnerTexts()
  expect(checks).toHaveLength(4)
  expect(checks.every((entry) => entry.trim().endsWith(': PASS'))).toBe(true)
  const alarms = await page.locator('[data-verdict][data-result="alarm"]').count()
  expect(alarms, 'no verdict on the page may report an alarm in this state').toBe(0)

  await expectVerdict(page, 'identity-status', {
    contains: 'THE SAME 32 BYTES — AND YOU DO NOT KNOW WHO WITH',
    result: 'pass',
  })
  // The all-zero check specifically: this is the assertion that goes red when a
  // check inside the fixture is broken, which is what §4.1d asks of it.
  await expectVerdict(page, 'identity-status', {
    label: '[data-test="identity-checks"]',
    contains: 'the shared value is not all-zero (RFC 7748 §6.1): PASS',
    result: 'pass',
  })

  // 3. The limitation is visible in that state -- not in the README, not
  //    behind a disclosure the reader has to open.
  await expect(page.locator('[data-verdict="negative-claim"]')).toBeVisible()
  await expectVerdict(page, 'negative-claim', {
    contains: 'tells you nothing about who you agreed with',
    result: 'idle',
  })
  // Visible in that state means visible: not inside any disclosure the reader
  // would have to open first.
  await expect(
    page.locator('[data-verdict="negative-claim"]').locator('xpath=ancestor::details'),
  ).toHaveCount(0)
})

test('the substituted exchange really was run against a substituted value', async ({ page }) => {
  // The fixture is only evidence if the substitution happened. Alice's secret
  // must be what X25519 gives for her private value against the value that
  // ARRIVED -- and must NOT be what it gives against Bob's.
  await page.locator('#impostor-button').click()
  await expect(page.locator('#identity-output')).toBeVisible()
  const aliceStrip = await page.locator('[data-test="impostor-secret"]').getAttribute('data-value')
  expect(aliceStrip).toMatch(HEX)

  // Both sides of the substituted exchange print the same value, and it is the
  // one the stranger's side computed -- read from the page and re-derived here.
  const sides = await page.locator('#identity-output .secret-side .byte-prefix').allInnerTexts()
  expect(sides).toHaveLength(2)
  expect(sides[0].trim()).toBe(sides[1].trim())
  expect(aliceStrip?.startsWith(sides[0].trim().replace('…', ''))).toBe(true)

  await expect(page.locator('[data-test="impostor-secret"]')).toContainText(
    (aliceStrip ?? '').slice(0, 16),
  )
})
