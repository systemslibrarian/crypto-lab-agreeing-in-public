import { describe, expect, it } from 'vitest'

import { freshExchange, runExchange } from '../exchange/exchange.js'
import { generateKeyPair, keyPairFrom } from '../x25519/agree.js'
import { fromHex, toHex } from '../x25519/bytes.js'
import { SECTION_6_1_EXCHANGE } from '../x25519/vectors.js'
import { attemptRecovery } from './attempt.js'
import { transcriptOf } from './transcript.js'

describe('an eavesdropper guessing a private value', () => {
  it('does not recover the secret from a wrong guess', () => {
    const exchange = freshExchange()
    const guess = generateKeyPair()
    const attempt = attemptRecovery(
      guess.privateValue,
      exchange.bob.publicValue,
      exchange.aliceSide.shared,
      1,
    )
    expect(attempt.recovered).toBe(false)
    expect(attempt.firstDifferentByte).toBeGreaterThanOrEqual(0)
    expect(attempt.attemptNumber).toBe(1)
  })

  it('fails on 100 independent guesses in a row', () => {
    const exchange = freshExchange()
    for (let run = 0; run < 100; run += 1) {
      const attempt = attemptRecovery(
        generateKeyPair().privateValue,
        exchange.bob.publicValue,
        exchange.aliceSide.shared,
        run + 1,
      )
      expect(attempt.recovered).toBe(false)
    }
  })

  /**
   * The positive control for the attempt path. If `recovered` could never be
   * true, the eavesdropper panel would be theatre rather than a measurement —
   * so this hands it Alice's actual private value and requires a yes.
   */
  it('reports recovery when handed the one private value that works', () => {
    const alice = keyPairFrom(fromHex(SECTION_6_1_EXCHANGE.alicePrivate))
    const bob = keyPairFrom(fromHex(SECTION_6_1_EXCHANGE.bobPrivate))
    const exchange = runExchange(alice, bob)
    const attempt = attemptRecovery(
      alice.privateValue,
      bob.publicValue,
      exchange.aliceSide.shared,
      1,
    )
    expect(attempt.recovered).toBe(true)
    expect(attempt.firstDifferentByte).toBe(-1)
    expect(toHex(attempt.derived)).toBe(SECTION_6_1_EXCHANGE.shared)
  })

  it('also reports recovery from Bob\'s private value, which is the other way in', () => {
    const alice = keyPairFrom(fromHex(SECTION_6_1_EXCHANGE.alicePrivate))
    const bob = keyPairFrom(fromHex(SECTION_6_1_EXCHANGE.bobPrivate))
    const exchange = runExchange(alice, bob)
    const attempt = attemptRecovery(
      bob.privateValue,
      alice.publicValue,
      exchange.aliceSide.shared,
      1,
    )
    expect(attempt.recovered).toBe(true)
  })
})

describe('the transcript', () => {
  it('carries the starting value and both public values, and nothing private', () => {
    const exchange = freshExchange()
    const transcript = transcriptOf(exchange)
    const crossed = transcript.crossed.map((entry) => entry.value)
    expect(crossed).toHaveLength(3)
    expect(crossed).toContain(toHex(exchange.alice.publicValue))
    expect(crossed).toContain(toHex(exchange.bob.publicValue))
    expect(crossed).not.toContain(toHex(exchange.alice.privateValue))
    expect(crossed).not.toContain(toHex(exchange.bob.privateValue))
  })

  it('names both private values as withheld rather than omitting them', () => {
    const exchange = freshExchange()
    const withheld = transcriptOf(exchange).withheld.map((entry) => entry.value)
    expect(withheld).toEqual([
      toHex(exchange.alice.privateValue),
      toHex(exchange.bob.privateValue),
    ])
  })

  it('never lists the shared secret, which crossed nothing', () => {
    const exchange = freshExchange()
    const transcript = transcriptOf(exchange)
    const everything = [...transcript.crossed, ...transcript.withheld].map((entry) => entry.value)
    expect(everything).not.toContain(toHex(exchange.aliceSide.shared))
  })
})
