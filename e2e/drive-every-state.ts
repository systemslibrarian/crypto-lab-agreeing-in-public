import { expect, type Page } from '@playwright/test'

/**
 * The DENOMINATOR, not a test.
 *
 * The marker-coverage rule and the outside-a-marker rule are both enumerated
 * over whatever this walk reaches, so anything rendering only in a state this
 * function never visits is outside the set those rules judge — and stays
 * outside however carefully the rules themselves are written.
 *
 * The rule, lane-wide: visit every option of every control that changes what
 * renders, each control on its own rather than the full cross-product.
 * Per-control is what keeps it affordable; the cross-product would buy
 * interaction coverage, which is a different question and not one the marker
 * rules ask.
 *
 * ## Every control on this page, and what it owes
 *
 * | Control | Options walked |
 * |---|---|
 * | `#analogy-step` | all four stages, plus the fifth press that wraps to stage one |
 * | `#exchange-button` | before its first press, after it, and after a second press (a fresh exchange, which retires a standing attempt) |
 * | `#working-details` | shut at arrival, opened through its own summary |
 * | `#roll-button` | its one press |
 * | `#try-button` | a rolled guess, a value that is not hex, a value of the wrong length, and the one value that DOES recover (Alice's own, read off the page) |
 * | `#candidate-input` | disabled at arrival, enabled after an exchange, edited to retire a standing attempt, and re-entered unchanged as the no-op |
 * | `#impostor-button` | its first press and its second |
 *
 * Deliberately NOT walked, with the reason:
 *
 * - `.skip-link` — focusing it moves focus and paints an outline; it renders no
 *   marker and changes none. The a11y gate drives it instead.
 * - the `THE ALL-ZERO VALUE — ABORT` branch of `zero-check` — not reachable
 *   through any control, because @noble/curves refuses a low-order public value
 *   before an all-zero result could be returned (src/x25519/agree.test.ts
 *   measures that refusal). It is reachable only under the recorded
 *   `zero-check-inverted` mutation, which is exactly where it is exercised.
 * - the `NOT THE SAME BYTES` branch of `shared-secret-match` and of
 *   `identity-status` — same: unreachable on a correct X25519, reached only
 *   under `comparison-always-different`.
 */
export async function driveEveryState(
  page: Page,
  visit: (state: string) => Promise<void>,
): Promise<void> {
  await visit('arrival')

  for (let stage = 2; stage <= 4; stage += 1) {
    await page.locator('#analogy-step').click()
    // data-stage, not the progress sentence: §4.1a wants structure here, so
    // that rewording "Step 2 of 4" fails a claims test rather than every
    // accessibility test at once, under a heading naming the wrong subject.
    await expect(page.locator('.analogy-board')).toHaveAttribute('data-stage', String(stage - 1))
    await visit(`analogy stage ${stage}`)
  }
  await page.locator('#analogy-step').click()
  await expect(page.locator('.analogy-board')).toHaveAttribute('data-stage', '0')
  await visit('analogy wrapped to stage one')

  await page.locator('#exchange-button').click()
  await expect(page.locator('#exchange-output')).toBeVisible()
  await visit('exchange run')

  await page.locator('#working-details summary').click()
  await expect(page.locator('#working-details')).toHaveAttribute('open', '')
  await visit('working disclosure open')

  await page.locator('#roll-button').click()
  await expect(page.locator('#candidate-input')).toHaveValue(/^[0-9a-f]{64}$/)
  await visit('guess rolled, not yet run')

  await page.locator('#try-button').click()
  await expect(page.locator('[data-verdict="guess-outcome"]')).toHaveCount(1)
  await visit('guess run and refused')

  // The no-op: re-entering the value already in the box must not retire the
  // standing attempt. Visited because "nothing changed" is a rendered state.
  const standing = (await page.locator('#candidate-input').inputValue()) ?? ''
  await page.locator('#candidate-input').fill(standing)
  await expect(page.locator('[data-verdict="guess-outcome"]')).toHaveCount(1)
  await visit('same value re-entered, attempt still standing')

  await page.locator('#candidate-input').fill('00')
  await expect(page.locator('#retired-note')).toBeVisible()
  await visit('attempt retired by an edit')

  await page.locator('#try-button').click()
  await expect(page.locator('#invalid-note')).toBeVisible()
  await visit('value of the wrong length refused')

  await page.locator('#candidate-input').fill('nothex!!')
  await page.locator('#try-button').click()
  await expect(page.locator('#invalid-note')).toBeVisible()
  await visit('value that is not hex refused')

  // The one guess that DOES recover: Alice's own private value, read off the
  // page's own disclosure. Without this the recovered branch of `guess-outcome`
  // and `recovery-status` would never render, and a mutation hard-wiring them
  // to "not recovered" would have nothing to kill.
  const alicePrivate = await page
    .locator('#working-output .working-row')
    .filter({ hasText: 'Alice’s private value' })
    .locator('code')
    .innerText()
  await page.locator('#candidate-input').fill(alicePrivate.trim())
  await page.locator('#try-button').click()
  await expect(page.locator('[data-verdict="guess-outcome"]')).toHaveCount(1)
  await visit('the one guess that recovers')

  await page.locator('#exchange-button').click()
  await expect(page.locator('#retired-note')).toBeVisible()
  await visit('fresh exchange retires the standing attempt')

  await page.locator('#impostor-button').click()
  await expect(page.locator('#identity-output')).toBeVisible()
  await visit('negative-claim fixture')

  await page.locator('#impostor-button').click()
  await expect(page.locator('[data-verdict="identity-status"]')).toHaveCount(1)
  await visit('negative-claim fixture, second run')

  for (const summary of await page.locator('summary').all()) {
    if (!(await summary.evaluate((node) => (node.parentElement as HTMLDetailsElement).open))) {
      await summary.click()
    }
  }
  await visit('every disclosure open')
}
