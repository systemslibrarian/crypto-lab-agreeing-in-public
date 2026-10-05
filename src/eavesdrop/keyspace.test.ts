import { x25519 } from '@noble/curves/ed25519.js'
import { describe, expect, it } from 'vitest'

import { toHex } from '../x25519/bytes.js'
import { generateKeyPair } from '../x25519/agree.js'
import {
  clamp,
  digitCount,
  DISTINCT_PRIVATE_VALUES,
  FIXED_BITS,
  KEYSPACE_DIGITS,
} from './keyspace.js'

describe('the guessing space the page describes', () => {
  it('is 76 digits long', () => {
    expect(KEYSPACE_DIGITS).toBe(76)
  })

  it('counts digits rather than rounding them', () => {
    expect(digitCount(1n)).toBe(1)
    expect(digitCount(999n)).toBe(3)
    expect(digitCount(1000n)).toBe(4)
  })

  it('is 2^251, five bits short of the 32 random bytes', () => {
    expect(DISTINCT_PRIVATE_VALUES).toBe(2n ** 251n)
    expect(FIXED_BITS).toBe(5)
    expect(digitCount(2n ** 256n)).toBe(78)
  })
})

describe('the clamping rule the count is derived from', () => {
  /**
   * The claim "five bits are fixed" is only worth the clamping it describes, so
   * this checks the five bits on values the library itself produced rather than
   * on values this file clamped.
   */
  it('fixes exactly those five bits in a library-generated private value', () => {
    for (let run = 0; run < 25; run += 1) {
      const { privateValue } = generateKeyPair()
      const clamped = clamp(privateValue)
      expect(clamped[0] & 0b0000_0111).toBe(0)
      expect(clamped[31] & 0b1000_0000).toBe(0)
      expect(clamped[31] & 0b0100_0000).toBe(0b0100_0000)
    }
  })

  it('agrees with the library: an unclamped and a clamped value share a public value', () => {
    // X25519 clamps internally, so a value and its clamp are the same private
    // key as far as the function is concerned. That is the fact that makes the
    // post-clamping count the real one.
    for (let run = 0; run < 25; run += 1) {
      const { privateValue } = generateKeyPair()
      expect(toHex(x25519.getPublicKey(clamp(privateValue)))).toBe(
        toHex(x25519.getPublicKey(privateValue)),
      )
    }
  })

  it('is idempotent, so clamping a clamped value changes nothing', () => {
    const { privateValue } = generateKeyPair()
    expect(toHex(clamp(clamp(privateValue)))).toBe(toHex(clamp(privateValue)))
  })
})
