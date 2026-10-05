import { expect, test } from '@playwright/test'

import { boot, DESKTOP, driveAllStates, NARROWEST, PHONE, watchPageErrors } from './gate.js'

/**
 * The WCAG 2.1 A/AA gate, at the three widths this lab is authored to.
 *
 * 320px is in here deliberately and is the one that catches reflow: it is the
 * narrowest width WCAG 1.4.10 is written against, and a 32-cell byte strip, a
 * three-lane diagram and a 64-character hex value all have to survive it
 * without the page scrolling sideways.
 */
for (const [name, viewport] of [
  ['1280px desktop', DESKTOP],
  ['390px phone', PHONE],
  ['320px narrowest', NARROWEST],
] as const) {
  test(`zero WCAG 2.1 A/AA findings across every reachable state at ${name}`, async ({ page }) => {
    test.setTimeout(600_000)
    const errors = watchPageErrors(page)
    await page.setViewportSize(viewport)
    await boot(page)
    await driveAllStates(page, name)
    expect(errors, errors.join('\n')).toEqual([])
  })
}
