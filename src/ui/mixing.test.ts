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
