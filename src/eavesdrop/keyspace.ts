/**
 * How much room there is to guess in, stated in a way a beginner can hold.
 *
 * RFC 7748 §5 clamps every X25519 private value before use: the lowest three
 * bits are cleared, the highest bit is cleared, and the second-highest is set.
 * So the 32 random bytes do not give 2^256 distinct private values — they give
 * exactly 2^251 of them, because 5 of the 256 bits are fixed.
 *
 * This number exists on the page as a digit COUNT rather than as a power,
 * because the page shows no exponents. It is derived here from the clamping
 * rule rather than typed in, and src/eavesdrop/keyspace.test.ts checks the rule
 * against what the library actually does to a private value — so the sentence a
 * reader sees cannot drift away from the arithmetic under it.
 */

/** The bits RFC 7748 §5 fixes: three at the bottom, two at the top. */
export const FIXED_BITS = 5

/** Distinct private values after clamping: 2^(256 - 5). */
export const DISTINCT_PRIVATE_VALUES = 2n ** BigInt(256 - FIXED_BITS)

export function digitCount(value: bigint): number {
  return value.toString().length
}

/** 76. What the page prints, and what the claims suite cross-checks it against. */
export const KEYSPACE_DIGITS = digitCount(DISTINCT_PRIVATE_VALUES)

/**
 * Clamping as RFC 7748 §5 specifies it, so the test can compare the rule above
 * against the library's own behaviour rather than against this file's opinion.
 */
export function clamp(privateValue: Uint8Array): Uint8Array {
  const clamped = Uint8Array.from(privateValue)
  clamped[0] &= 248
  clamped[31] &= 127
  clamped[31] |= 64
  return clamped
}
