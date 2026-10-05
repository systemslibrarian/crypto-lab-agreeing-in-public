import { x25519 } from '@noble/curves/ed25519.js'
import { describe, expect, it } from 'vitest'

import { sameBytes } from '../verify/compare.js'
import { agree, BASEPOINT, checkSection52Vectors, generateKeyPair, keyPairFrom } from './agree.js'
import { fromHex, toHex } from './bytes.js'
import { SECTION_5_2_ITERATED, SECTION_5_2_VECTORS, SECTION_6_1_EXCHANGE } from './vectors.js'

describe('RFC 7748 §5.2 known-answer tests', () => {
  it.each(SECTION_5_2_VECTORS)('matches $label', (vector) => {
    const computed = x25519.getSharedSecret(fromHex(vector.scalar), fromHex(vector.u))
    expect(toHex(computed)).toBe(vector.output)
  })

  it('matches the iterated result after one iteration', () => {
    const start = fromHex(SECTION_5_2_ITERATED.start)
    expect(toHex(x25519.getSharedSecret(start, start))).toBe(SECTION_5_2_ITERATED.afterOne)
  })

  it('matches the iterated result after 1,000 iterations', () => {
    // The RFC also publishes a 1,000,000-iteration result. It is not run here:
    // it costs minutes and covers nothing this lab claims that 1,000 does not.
    let scalar = fromHex(SECTION_5_2_ITERATED.start)
    let u = fromHex(SECTION_5_2_ITERATED.start)
    for (let i = 0; i < 1000; i += 1) {
      const next = x25519.getSharedSecret(scalar, u)
      u = scalar
      scalar = next
    }
    expect(toHex(scalar)).toBe(SECTION_5_2_ITERATED.afterOneThousand)
  })

  it('reports every vector as matching through the page\'s own checker', () => {
    const results = checkSection52Vectors()
    expect(results).toHaveLength(SECTION_5_2_VECTORS.length)
    expect(results.every((result) => result.matches)).toBe(true)
    expect(results.map((result) => result.computed)).toEqual(
      SECTION_5_2_VECTORS.map((vector) => vector.output),
    )
  })
})

describe('RFC 7748 §6.1 — the worked exchange', () => {
  const vector = SECTION_6_1_EXCHANGE

  it('derives Alice\'s published public value from her private one', () => {
    expect(toHex(keyPairFrom(fromHex(vector.alicePrivate)).publicValue)).toBe(vector.alicePublic)
  })

  it('derives Bob\'s published public value from his private one', () => {
    expect(toHex(keyPairFrom(fromHex(vector.bobPrivate)).publicValue)).toBe(vector.bobPublic)
  })

  it('lands on the RFC\'s shared secret from Alice\'s side', () => {
    const result = agree(fromHex(vector.alicePrivate), fromHex(vector.bobPublic))
    expect(toHex(result.shared)).toBe(vector.shared)
    expect(result.allZero).toBe(false)
  })

  it('lands on the same shared secret from Bob\'s side', () => {
    const result = agree(fromHex(vector.bobPrivate), fromHex(vector.alicePublic))
    expect(toHex(result.shared)).toBe(vector.shared)
  })

  it('uses the §4.1 base point to produce the published public values', () => {
    expect(toHex(BASEPOINT)).toBe(
      '0900000000000000000000000000000000000000000000000000000000000000',
    )
    const fromBasepoint = agree(fromHex(vector.alicePrivate), BASEPOINT)
    expect(toHex(fromBasepoint.shared)).toBe(vector.alicePublic)
  })
})

describe('round trip over freshly generated pairs', () => {
  it('has both sides agree, 50 times over', () => {
    for (let run = 0; run < 50; run += 1) {
      const alice = generateKeyPair()
      const bob = generateKeyPair()
      const aliceSide = agree(alice.privateValue, bob.publicValue)
      const bobSide = agree(bob.privateValue, alice.publicValue)
      expect(sameBytes(aliceSide.shared, bobSide.shared)).toBe(true)
      expect(aliceSide.allZero).toBe(false)
    }
  })

  /**
   * The negative control, and it carries as much weight as the positive one: a
   * round-trip test alone passes against an implementation that returns a
   * constant. Pairing Alice with a third party has to produce something ELSE.
   */
  it('has mismatched pairings disagree, 50 times over', () => {
    for (let run = 0; run < 50; run += 1) {
      const alice = generateKeyPair()
      const bob = generateKeyPair()
      const carol = generateKeyPair()
      const aliceWithBob = agree(alice.privateValue, bob.publicValue)
      const aliceWithCarol = agree(alice.privateValue, carol.publicValue)
      const carolWithBob = agree(carol.privateValue, bob.publicValue)
      expect(sameBytes(aliceWithBob.shared, aliceWithCarol.shared)).toBe(false)
      expect(sameBytes(aliceWithBob.shared, carolWithBob.shared)).toBe(false)
    }
  })

  it('produces a different public value for every fresh private value', () => {
    const seen = new Set<string>()
    for (let run = 0; run < 50; run += 1) seen.add(toHex(generateKeyPair().publicValue))
    expect(seen.size).toBe(50)
  })
})

describe('what the library refuses', () => {
  /**
   * RFC 7748 §6.1 allows a party to abort on an all-zero result. @noble/curves
   * does not hand one back to abort on — it throws instead. This test is what
   * makes src/verify/zero-check.ts's claim about its own reachability a
   * measured fact rather than a reading of the library's documentation.
   */
  it('throws rather than returning all zeros for a low-order public value', () => {
    const alice = generateKeyPair()
    expect(() => agree(alice.privateValue, new Uint8Array(32))).toThrow(/invalid/i)
  })

  it('rejects a public value that is not 32 bytes', () => {
    const alice = generateKeyPair()
    expect(() => agree(alice.privateValue, new Uint8Array(31))).toThrow()
  })

  it('rejects a private value that is not 32 bytes', () => {
    const bob = generateKeyPair()
    expect(() => agree(new Uint8Array(16), bob.publicValue)).toThrow()
  })
})
