import { agree, generateKeyPair, type Agreement, type KeyPair } from '../x25519/agree.js'
import { firstDifference, sameBytes } from '../verify/compare.js'

/**
 * One real X25519 exchange, with the two sides computed separately.
 *
 * `aliceSide` is handed only what Alice knows — her own private value and the
 * public value that arrived — and `bobSide` only what Bob knows. Neither is
 * given the other's private value or the other's answer, so the comparison at
 * the end is a comparison of two independent computations rather than a value
 * copied into two places. That is the difference between showing agreement and
 * asserting it, and it is why the two byte strips on the page can be trusted to
 * be two byte strips.
 */

export interface Exchange {
  readonly alice: KeyPair
  readonly bob: KeyPair
  /** What Alice computed: her private value combined with the value Bob sent. */
  readonly aliceSide: Agreement
  /** What Bob computed: his private value combined with the value Alice sent. */
  readonly bobSide: Agreement
  /** The measured byte-for-byte comparison of those two results. */
  readonly match: boolean
  /** -1 when they are identical; otherwise the index of the first difference. */
  readonly firstDifferentByte: number
}

export function runExchange(alice: KeyPair, bob: KeyPair): Exchange {
  const aliceSide = agree(alice.privateValue, bob.publicValue)
  const bobSide = agree(bob.privateValue, alice.publicValue)
  return {
    alice,
    bob,
    aliceSide,
    bobSide,
    match: sameBytes(aliceSide.shared, bobSide.shared),
    firstDifferentByte: firstDifference(aliceSide.shared, bobSide.shared),
  }
}

/** A fresh exchange between two parties who have never met. */
export function freshExchange(): Exchange {
  return runExchange(generateKeyPair(), generateKeyPair())
}
