import { describe, expect, it } from 'vitest'

import {
  ALICE_COLOUR,
  ALICE_MIXTURE,
  BOB_COLOUR,
  BOB_MIXTURE,
  combine,
  css,
  PUBLIC_COLOUR,
  SHARED_COLOUR,
  watcherReconstruction,
} from './mixing.js'

describe('the picture has the property it illustrates', () => {
  /**
   * The analogy's entire claim. If this failed, the page would be drawing two
   * different colours and asserting they were the same — the exact "visual
   * honesty" failure §2 of the fleet standard names.
   */
  it('lands on the same colour whichever side mixes last', () => {
    const aliceAddsHers = combine([PUBLIC_COLOUR, BOB_COLOUR, ALICE_COLOUR])
    const bobAddsHis = combine([PUBLIC_COLOUR, ALICE_COLOUR, BOB_COLOUR])
    expect(aliceAddsHers).toEqual(bobAddsHis)
    expect(css(aliceAddsHers)).toBe(css(SHARED_COLOUR))
  })

  it('does not reach the shared colour from either mixture alone', () => {
    expect(css(ALICE_MIXTURE)).not.toBe(css(SHARED_COLOUR))
    expect(css(BOB_MIXTURE)).not.toBe(css(SHARED_COLOUR))
  })

  it('gives the two sent mixtures different colours', () => {
    expect(css(ALICE_MIXTURE)).not.toBe(css(BOB_MIXTURE))
  })

  /**
   * The naive model — average the two mixtures — is what the picture must NOT
   * use. Recorded as a test so nobody reintroduces it: it double-weights the
   * public colour and lands somewhere neither party is.
   */
  it('is not the pairwise average of the two mixtures', () => {
    const pairwise = combine([ALICE_MIXTURE, BOB_MIXTURE])
    expect(css(pairwise)).not.toBe(css(SHARED_COLOUR))
  })
})

describe('what the picture does NOT show', () => {
  /**
   * The limit of the analogy, as a measured fact rather than a caveat.
   *
   * Averaging is reversible, so a watcher holding the public colour and the two
   * sent mixtures can recover both private colours and mix the shared one
   * herself. The panel used to tell the reader she could not. She can, and this
   * is the test that says so — which is what keeps the panel's copy honest, and
   * is the precise reason the real exchange in panel 2 is not optional.
   */
  it('lets the watcher reconstruct the shared colour from public information alone', () => {
    const reconstructed = watcherReconstruction(PUBLIC_COLOUR, ALICE_MIXTURE, BOB_MIXTURE)
    expect(css(reconstructed)).toBe(css(SHARED_COLOUR))
  })

  it('lets the watcher recover both private colours to within rounding', () => {
    const unmix = (mixture: readonly number[]): number[] =>
      [0, 1, 2].map((channel) => 2 * mixture[channel] - PUBLIC_COLOUR[channel])
    for (const [recovered, actual] of [
      [unmix(ALICE_MIXTURE), ALICE_COLOUR],
      [unmix(BOB_MIXTURE), BOB_COLOUR],
    ] as const) {
      for (const channel of [0, 1, 2]) {
        // Within 1: `combine` rounds, so one bit of the original can be lost.
        expect(Math.abs(recovered[channel] - actual[channel])).toBeLessThanOrEqual(1)
      }
    }
  })

  it('is a different situation from the real exchange, which is the point', () => {
    // Stated as an assertion so the contrast cannot quietly disappear: the
    // paint model is reversible arithmetic, X25519 is not known to be.
    expect(css(watcherReconstruction(PUBLIC_COLOUR, ALICE_MIXTURE, BOB_MIXTURE))).toBe(
      css(SHARED_COLOUR),
    )
  })

  it('keeps every swatch inside the byte range', () => {
    for (const colour of [PUBLIC_COLOUR, ALICE_COLOUR, BOB_COLOUR, ALICE_MIXTURE, BOB_MIXTURE, SHARED_COLOUR]) {
      for (const channel of colour) {
        expect(channel).toBeGreaterThanOrEqual(0)
        expect(channel).toBeLessThanOrEqual(255)
        expect(Number.isInteger(channel)).toBe(true)
      }
    }
  })

  it('refuses an empty mixture rather than returning black', () => {
    expect(() => combine([])).toThrow(/at least one colour/)
  })

  it('renders six-digit lower-case hex', () => {
    expect(css(PUBLIC_COLOUR)).toBe('#38b2a8')
    expect(css(ALICE_COLOUR)).toBe('#f0c33c')
    expect(css(BOB_COLOUR)).toBe('#b85cd6')
  })
})
