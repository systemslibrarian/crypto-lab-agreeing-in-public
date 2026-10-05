import { describe, expect, it } from 'vitest'

import { fromHex, toHex } from '../x25519/bytes.js'
import { generateKeyPair, keyPairFrom } from '../x25519/agree.js'
import { SECTION_6_1_EXCHANGE } from '../x25519/vectors.js'
import { freshExchange, runExchange } from './exchange.js'

describe('one exchange', () => {
  it('reproduces RFC 7748 §6.1 end to end', () => {
    const exchange = runExchange(
      keyPairFrom(fromHex(SECTION_6_1_EXCHANGE.alicePrivate)),
      keyPairFrom(fromHex(SECTION_6_1_EXCHANGE.bobPrivate)),
    )
    expect(toHex(exchange.alice.publicValue)).toBe(SECTION_6_1_EXCHANGE.alicePublic)
    expect(toHex(exchange.bob.publicValue)).toBe(SECTION_6_1_EXCHANGE.bobPublic)
    expect(toHex(exchange.aliceSide.shared)).toBe(SECTION_6_1_EXCHANGE.shared)
    expect(toHex(exchange.bobSide.shared)).toBe(SECTION_6_1_EXCHANGE.shared)
    expect(exchange.match).toBe(true)
    expect(exchange.firstDifferentByte).toBe(-1)
  })

  it('agrees on a fresh pair every time, 50 times over', () => {
    for (let run = 0; run < 50; run += 1) {
      const exchange = freshExchange()
      expect(exchange.match).toBe(true)
      expect(exchange.firstDifferentByte).toBe(-1)
      expect(exchange.aliceSide.shared).toHaveLength(32)
    }
  })

  it('gives a different shared secret to every fresh exchange', () => {
    const seen = new Set<string>()
    for (let run = 0; run < 50; run += 1) seen.add(toHex(freshExchange().aliceSide.shared))
    expect(seen.size).toBe(50)
  })

  /**
   * The negative control at the level the page renders. Pair Alice with a third
   * party and Bob's answer must stop matching — a `match` that could not be
   * false would make the headline verdict a decoration.
   */
  it('does not match when the two sides were not talking to each other', () => {
    for (let run = 0; run < 50; run += 1) {
      const alice = generateKeyPair()
      const bob = generateKeyPair()
      const carol = generateKeyPair()
      const crossed = runExchange(alice, bob)
      const wrong = runExchange(alice, carol)
      expect(crossed.match).toBe(true)
      expect(toHex(wrong.aliceSide.shared)).not.toBe(toHex(crossed.aliceSide.shared))
    }
  })

  it('computes each side only from what that side knows', () => {
    // Alice's result must be reproducible from (her private value, Bob's PUBLIC
    // value) alone, and Bob's from the mirror image. If either side had quietly
    // been handed the other's private value, one of these would not reproduce.
    const exchange = freshExchange()
    const aliceAlone = runExchange(exchange.alice, { ...exchange.bob, privateValue: new Uint8Array(32) })
    expect(toHex(aliceAlone.aliceSide.shared)).toBe(toHex(exchange.aliceSide.shared))
  })

  it('reports the result is not the all-zero value on both sides', () => {
    const exchange = freshExchange()
    expect(exchange.aliceSide.allZero).toBe(false)
    expect(exchange.bobSide.allZero).toBe(false)
  })
})
