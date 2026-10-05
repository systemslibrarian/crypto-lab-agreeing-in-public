import { toHex } from '../x25519/bytes.js'
import { BASEPOINT } from '../x25519/agree.js'
import type { Exchange } from '../exchange/exchange.js'

/**
 * Everything that crossed the wire, and everything that did not.
 *
 * The eavesdropper's panel has to read as ORDINARY AND COMPLETE — nothing is
 * withheld from her, because the whole point is that a full transcript is not
 * enough. So this is built from the exchange itself rather than from a
 * hand-written list: a value that starts crossing the wire later cannot quietly
 * fail to appear here.
 */

export interface WireEntry {
  readonly label: string
  readonly from: string
  readonly value: string
  readonly note: string
}

export interface Transcript {
  /** In the clear, in order. Everything an observer sees. */
  readonly crossed: readonly WireEntry[]
  /** Named, and shown as withheld. Neither ever leaves its owner's machine. */
  readonly withheld: readonly WireEntry[]
}

export function transcriptOf(exchange: Exchange): Transcript {
  return {
    crossed: [
      {
        label: 'Starting value',
        from: 'the specification',
        value: toHex(BASEPOINT),
        note: 'Fixed in RFC 7748 and the same for everyone, everywhere.',
      },
      {
        label: 'Alice sends',
        from: 'Alice',
        value: toHex(exchange.alice.publicValue),
        note: 'Her private value mixed with the starting value.',
      },
      {
        label: 'Bob sends',
        from: 'Bob',
        value: toHex(exchange.bob.publicValue),
        note: 'His private value mixed with the starting value.',
      },
    ],
    withheld: [
      {
        label: 'Alice keeps',
        from: 'Alice',
        value: toHex(exchange.alice.privateValue),
        note: 'Never sent. Shown here only because this page is her machine too.',
      },
      {
        label: 'Bob keeps',
        from: 'Bob',
        value: toHex(exchange.bob.privateValue),
        note: 'Never sent, and never seen by Alice either.',
      },
    ],
  }
}
