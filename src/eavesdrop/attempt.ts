import { agree } from '../x25519/agree.js'
import { firstDifference, sameBytes } from '../verify/compare.js'

/**
 * What an eavesdropper can actually do, run for real.
 *
 * She has the two public values and the starting value — the complete
 * transcript. What she wants is the shared secret. The function that produces
 * it needs a PRIVATE value, and she has none, so the only move available to her
 * is to supply one and see. That is what this does: it takes a candidate
 * private value, runs the same real X25519 the honest parties ran, and compares
 * the result to the secret they are holding.
 *
 * The comparison is src/verify/compare.ts's, the same one the headline verdict
 * uses, and `recovered` is its answer rather than a constant. Nothing here
 * models, estimates or simulates an attack; a guess that happened to be right
 * would be reported as right.
 */

export interface RecoveryAttempt {
  readonly candidate: Uint8Array
  /** What the candidate actually produces against the value Bob published. */
  readonly derived: Uint8Array
  /**
   * The byte comparison: are these two values the same bytes? This drives the
   * strip-against-strip verdict a reader sees.
   */
  readonly sameAsReal: boolean
  /**
   * The eavesdropper's CLAIM: did she recover the shared secret?
   *
   * On this page the two coincide, and keeping them as separate fields is the
   * point rather than an oversight. "These two byte strings are equal" and
   * "the attack succeeded" are different assertions that happen to have the
   * same answer here, and a panel is only trustworthy if the second one is
   * wired to a measurement rather than to a constant. The two recorded
   * mutations `comparison-always-identical` and `eavesdropper-claims-recovery`
   * attack them separately, which is how that stays true.
   */
  readonly recovered: boolean
  readonly firstDifferentByte: number
  /** Which attempt this was, counting from one. */
  readonly attemptNumber: number
}

export function attemptRecovery(
  candidate: Uint8Array,
  publishedPublicValue: Uint8Array,
  realSharedSecret: Uint8Array,
  attemptNumber: number,
): RecoveryAttempt {
  const derived = agree(candidate, publishedPublicValue).shared
  const sameAsReal = sameBytes(derived, realSharedSecret)
  return {
    candidate,
    derived,
    sameAsReal,
    recovered: sameAsReal,
    firstDifferentByte: firstDifference(derived, realSharedSecret),
    attemptNumber,
  }
}
