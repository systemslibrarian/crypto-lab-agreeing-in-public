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

describe('candidates X25519 treats as identical', () => {
  /**
   * The regression for the copy repair. The page used to say a private value
   * "wrong by one bit is wrong by everything"; RFC 7748 §5 fixes five bits
   * before use, so a candidate differing only in those bits is the SAME private
   * value to the function and recovers the secret. Measured here rather than
   * reasoned about, so the expert note the page now carries cannot drift.
   */
  it.each([
    ['the lowest bit of the first byte', 0, 0b0000_0001],
    ['the second bit of the first byte', 0, 0b0000_0010],
    ['the third bit of the first byte', 0, 0b0000_0100],
    ['the highest bit of the last byte', 31, 0b1000_0000],
  ])('still recovers when %s is flipped', (_label, index, mask) => {
    const alice = generateKeyPair()
    const bob = generateKeyPair()
    const exchange = runExchange(alice, bob)

    const twiddled = Uint8Array.from(alice.privateValue)
    twiddled[index] ^= mask
    expect(toHex(twiddled)).not.toBe(toHex(alice.privateValue))

    const attempt = attemptRecovery(twiddled, bob.publicValue, exchange.aliceSide.shared, 1)
    expect(attempt.recovered).toBe(true)
  })

  it('does NOT recover when a bit X25519 actually uses is flipped', () => {
    // The control. If every flip recovered, the test above would be measuring
    // a broken comparison rather than the clamping rule.
    const alice = generateKeyPair()
    const bob = generateKeyPair()
    const exchange = runExchange(alice, bob)
    const twiddled = Uint8Array.from(alice.privateValue)
    twiddled[0] ^= 0b0000_1000 // bit 3: the lowest bit clamping leaves alone
    const attempt = attemptRecovery(twiddled, bob.publicValue, exchange.aliceSide.shared, 1)
    expect(attempt.recovered).toBe(false)
  })

  it('does not recover from Bob\u2019s private value against Bob\u2019s own public value', () => {
    // The pairing the page's guess panel actually performs. Bob's private
    // value needs ALICE's public value, which this exercise never supplies --
    // which is why the panel scopes itself to guessing Alice's.
    const alice = generateKeyPair()
    const bob = generateKeyPair()
    const exchange = runExchange(alice, bob)
    const attempt = attemptRecovery(bob.privateValue, bob.publicValue, exchange.aliceSide.shared, 1)
    expect(attempt.recovered).toBe(false)
  })
})

describe('the transcript', () => {
  it('carries exactly the two public values as sent, and nothing private', () => {
    const exchange = freshExchange()
    const transcript = transcriptOf(exchange)
    const sent = transcript.sent.map((entry) => entry.value)
    expect(sent).toEqual([
      toHex(exchange.alice.publicValue),
      toHex(exchange.bob.publicValue),
    ])
    expect(sent).not.toContain(toHex(exchange.alice.privateValue))
    expect(sent).not.toContain(toHex(exchange.bob.privateValue))
  })

  it('counts the starting value as already public rather than as a message', () => {
    // Two messages cross the wire, not three. The starting value is fixed in
    // the specification, so listing it as traffic would overcount by one and
    // invent a per-exchange message.
    const transcript = transcriptOf(freshExchange())
    expect(transcript.alreadyPublic).toHaveLength(1)
    expect(transcript.sent).toHaveLength(2)
    expect(transcript.alreadyPublic[0].value).toBe(
      '0900000000000000000000000000000000000000000000000000000000000000',
    )
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
    const everything = [
      ...transcript.alreadyPublic,
      ...transcript.sent,
      ...transcript.withheld,
    ].map((entry) => entry.value)
    expect(everything).not.toContain(toHex(exchange.aliceSide.shared))
  })
})
