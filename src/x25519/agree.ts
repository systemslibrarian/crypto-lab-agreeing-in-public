import { x25519 } from '@noble/curves/ed25519.js'

import { sameBytes } from '../verify/compare.js'
import { isAllZero } from '../verify/zero-check.js'
import { fromHex, toHex } from './bytes.js'
import { SECTION_5_2_VECTORS } from './vectors.js'

/**
 * X25519 as RFC 7748 defines it, via @noble/curves.
 *
 * Only three operations are needed for the whole lab, and they are the three
 * RFC 7748 §6.1 names: make a private value, turn it into the public value you
 * send, and combine someone else's public value with your own private one.
 * Nothing here reimplements the curve — §0 of the fleet standard asks for a
 * named, justified library where the primitive is not itself the teaching
 * subject, and here the teaching subject is the OUTCOME of the exchange. What
 * this lab hand-rolls is the inspectable part the reader is asked to believe:
 * the comparison (src/verify/compare.ts) and the §6.1 check
 * (src/verify/zero-check.ts).
 */

/**
 * The public value everybody starts from — u = 9, the Curve25519 base point,
 * RFC 7748 §4.1. It is a constant in the spec, not a secret and not per-session.
 */
export const BASEPOINT: Uint8Array = fromHex(
  '0900000000000000000000000000000000000000000000000000000000000000',
)

export interface KeyPair {
  /** 32 bytes nobody else ever sees. Per-session, in memory, never stored. */
  readonly privateValue: Uint8Array
  /** 32 bytes sent in the clear. This is the one that crosses the wire. */
  readonly publicValue: Uint8Array
}

/** A fresh pair from the browser's CSPRNG, via the library's own keygen. */
export function generateKeyPair(): KeyPair {
  const { secretKey, publicKey } = x25519.keygen()
  return { privateValue: secretKey, publicValue: publicKey }
}

/** A pair from a given private value — how the RFC's own §6.1 vectors are replayed. */
export function keyPairFrom(privateValue: Uint8Array): KeyPair {
  return { privateValue, publicValue: x25519.getPublicKey(privateValue) }
}

export interface Agreement {
  readonly shared: Uint8Array
  /**
   * RFC 7748 §6.1's optional abort condition. False on every honest exchange —
   * see src/verify/zero-check.ts for why it cannot be otherwise here, and why
   * the check is kept and reported anyway.
   */
  readonly allZero: boolean
}

/**
 * Combine a peer's public value with your own private one. This is the single
 * function the whole lab turns on: called with (a, K_B) and with (b, K_A) it
 * returns the same 32 bytes, which is RFC 7748 §6.1's entire claim.
 */
export function agree(ownPrivate: Uint8Array, peerPublic: Uint8Array): Agreement {
  const shared = x25519.getSharedSecret(ownPrivate, peerPublic)
  return { shared, allZero: isAllZero(shared) }
}

export interface VectorResult {
  readonly label: string
  readonly expected: string
  readonly computed: string
  readonly matches: boolean
}

/**
 * Run the RFC's own published vectors through the real function, in the
 * reader's browser, at page load.
 *
 * This is what lets the page say "this is the real thing" as a result rather
 * than as a promise: the numbers are RFC 7748 §5.2's, nothing recomputes them,
 * and the comparison is the same `sameBytes` every other verdict uses.
 */
export function checkSection52Vectors(): readonly VectorResult[] {
  return SECTION_5_2_VECTORS.map((vector) => {
    const computed = x25519.getSharedSecret(fromHex(vector.scalar), fromHex(vector.u))
    return {
      label: vector.label,
      expected: vector.output,
      computed: toHex(computed),
      matches: sameBytes(computed, fromHex(vector.output)),
    }
  })
}
