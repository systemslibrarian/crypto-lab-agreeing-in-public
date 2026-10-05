import { agree, generateKeyPair, type Agreement, type KeyPair } from '../x25519/agree.js'
import { firstDifference, sameBytes } from '../verify/compare.js'
import { checkSection52Vectors } from '../x25519/agree.js'

/**
 * The negative claim, built rather than disclaimed (§4.1d).
 *
 * The belief a beginner most plausibly leaves this page holding is: *we agreed
 * on a secret, so I know who I agreed with.* This module is the state that
 * shows it is false, and it shows it the only honest way — by letting the
 * mechanism succeed completely.
 *
 * Alice sets out to agree with Bob. Somebody else's public value arrives
 * instead of Bob's. Alice combines her private value with what arrived; the
 * holder of that value combines theirs with Alice's. The two results are the
 * same 32 bytes, every check the page performs passes, and there is no failure
 * code to raise — because agreement was never a claim about identity. Bob is
 * not involved at any point and never finds out.
 *
 * The attack this makes concrete is handed on to crypto-lab-diffie-hellman-mitm
 * rather than built here; this lab's job is to establish that the gap exists.
 */

export interface CheckOutcome {
  readonly label: string
  readonly passed: boolean
}

export interface SubstitutedExchange {
  readonly alice: KeyPair
  /** The real Bob. His public value never reaches Alice, and he never runs. */
  readonly bob: KeyPair
  /** Whoever actually answered. Alice cannot tell this apart from Bob. */
  readonly impostor: KeyPair
  /** Alice's result: her private value with the value that ARRIVED. */
  readonly aliceSide: Agreement
  /** The answering party's result: their private value with Alice's. */
  readonly impostorSide: Agreement
  readonly match: boolean
  readonly firstDifferentByte: number
  /**
   * Every check this page performs, in this state. All of them pass — that is
   * the exhibit, so the list is computed rather than written out, and a check
   * that failed would appear here as a failure instead of being dropped.
   */
  readonly checks: readonly CheckOutcome[]
}

export function runSubstitutedExchange(
  alice: KeyPair,
  bob: KeyPair,
  impostor: KeyPair,
): SubstitutedExchange {
  const aliceSide = agree(alice.privateValue, impostor.publicValue)
  const impostorSide = agree(impostor.privateValue, alice.publicValue)
  const match = sameBytes(aliceSide.shared, impostorSide.shared)
  const checks: CheckOutcome[] = [
    { label: 'both sides derived the same 32 bytes', passed: match },
    {
      label: 'the shared value is not all-zero (RFC 7748 §6.1)',
      passed: !aliceSide.allZero && !impostorSide.allZero,
    },
    {
      label: 'the public value that arrived is 32 bytes X25519 accepted',
      passed: impostor.publicValue.length === 32,
    },
    {
      label: 'the RFC 7748 §5.2 vectors still match',
      passed: checkSection52Vectors().every((result) => result.matches),
    },
  ]
  return {
    alice,
    bob,
    impostor,
    aliceSide,
    impostorSide,
    match,
    firstDifferentByte: firstDifference(aliceSide.shared, impostorSide.shared),
    checks,
  }
}

export function freshSubstitutedExchange(): SubstitutedExchange {
  return runSubstitutedExchange(generateKeyPair(), generateKeyPair(), generateKeyPair())
}
