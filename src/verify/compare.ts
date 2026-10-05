/**
 * The one byte-for-byte comparison in this lab.
 *
 * Every verdict that says two values are or are not the same bytes comes
 * through here: the headline comparison of Alice's and Bob's results, the
 * eavesdropper's guess against the real secret, and the on-page RFC 7748 §5.2
 * vector check. That is deliberate — one function means one mutation can ask
 * the whole page whether its comparisons are wired to a measurement or to a
 * constant, and e2e/verdict-mutations.json records both directions:
 * `comparison-always-identical` and `comparison-always-different`.
 *
 * It is not constant-time and does not need to be: both operands are already
 * public to whoever is running this page, and nothing here guards a secret
 * against its own browser. A lab that claimed constant-time comparison would
 * owe a measurement; this one claims the opposite, out loud.
 */
export function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  return left.every((byte, index) => byte === right[index])
}

/** Index of the first byte that differs, or -1 when they are identical. */
export function firstDifference(left: Uint8Array, right: Uint8Array): number {
  const limit = Math.max(left.length, right.length)
  for (let index = 0; index < limit; index += 1) {
    if (left[index] !== right[index]) return index
  }
  return -1
}
