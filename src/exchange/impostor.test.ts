import { describe, expect, it } from 'vitest'

import { agree, generateKeyPair } from '../x25519/agree.js'
import { toHex } from '../x25519/bytes.js'
import { sameBytes } from '../verify/compare.js'
import { freshSubstitutedExchange, runSubstitutedExchange } from './impostor.js'

describe('an exchange against a substituted public value', () => {
  /**
   * The §4.1d negative claim, as a unit result: the mechanism is perfectly
   * happy. A reader who leaves believing "we agreed on a secret, so I know who
   * I agreed with" is contradicted by this test, not by a sentence.
   */
  it('still produces a matching pair of secrets, 50 times over', () => {
    for (let run = 0; run < 50; run += 1) {
      const substituted = freshSubstitutedExchange()
      expect(substituted.match).toBe(true)
      expect(substituted.firstDifferentByte).toBe(-1)
    }
  })

  it('passes every check the page performs', () => {
    const substituted = freshSubstitutedExchange()
    expect(substituted.checks).toHaveLength(4)
    expect(substituted.checks.every((check) => check.passed)).toBe(true)
    expect(substituted.checks.map((check) => check.label)).toEqual([
      'both sides derived the same 32 bytes',
      'the shared value is not all-zero (RFC 7748 §6.1)',
      'the public value that arrived is 32 bytes X25519 accepted',
      'the RFC 7748 §5.2 vectors still match',
    ])
  })

  it('agrees with the impostor and not with Bob', () => {
    const substituted = freshSubstitutedExchange()
    const withImpostor = agree(
      substituted.alice.privateValue,
      substituted.impostor.publicValue,
    ).shared
    const withBob = agree(substituted.alice.privateValue, substituted.bob.publicValue).shared
    expect(sameBytes(substituted.aliceSide.shared, withImpostor)).toBe(true)
    expect(sameBytes(substituted.aliceSide.shared, withBob)).toBe(false)
  })

  it('leaves Bob holding nothing — he never ran and never found out', () => {
    const substituted = freshSubstitutedExchange()
    const whatBobWouldHave = agree(
      substituted.bob.privateValue,
      substituted.alice.publicValue,
    ).shared
    expect(sameBytes(whatBobWouldHave, substituted.aliceSide.shared)).toBe(false)
  })

  it('is indistinguishable from an honest exchange in everything Alice can see', () => {
    // Alice sees: a 32-byte public value arrived, and her own result matches
    // the other side's. Both are true here. That is the whole claim.
    const substituted = freshSubstitutedExchange()
    expect(substituted.impostor.publicValue).toHaveLength(32)
    expect(substituted.aliceSide.shared).toHaveLength(32)
    expect(substituted.aliceSide.allZero).toBe(false)
    expect(substituted.match).toBe(true)
  })

  it('names a different impostor on every fresh run', () => {
    const seen = new Set<string>()
    for (let run = 0; run < 25; run += 1) {
      seen.add(toHex(freshSubstitutedExchange().impostor.publicValue))
    }
    expect(seen.size).toBe(25)
  })

  it('is driven by the value that arrives, not by who it is labelled as', () => {
    // Substituting Bob's own pair back in reproduces the honest exchange,
    // which is what says this fixture turns on the substituted VALUE.
    const alice = generateKeyPair()
    const bob = generateKeyPair()
    const notSubstituted = runSubstitutedExchange(alice, bob, bob)
    expect(notSubstituted.match).toBe(true)
    expect(toHex(notSubstituted.aliceSide.shared)).toBe(
      toHex(agree(alice.privateValue, bob.publicValue).shared),
    )
  })
})
