/**
 * Test vectors copied from RFC 7748, by section, with nothing recomputed.
 *
 * These are the published numbers, not numbers this lab derived and then
 * checked against itself. src/x25519/agree.test.ts runs the real X25519 against
 * them; src/ui/exchange-panel.ts runs the same check in the reader's browser so
 * the page's claim to be using the real function is a result on screen rather
 * than a sentence in a README.
 */

/** RFC 7748 §5.2 — one scalar multiplication, input and expected output. */
export interface ScalarVector {
  readonly label: string
  readonly scalar: string
  readonly u: string
  readonly output: string
}

/** RFC 7748 §5.2, "Test vector #1" and "Test vector #2". */
export const SECTION_5_2_VECTORS: readonly ScalarVector[] = [
  {
    label: 'RFC 7748 §5.2 test vector #1',
    scalar: 'a546e36bf0527c9d3b16154b82465edd62144c0ac1fc5a18506a2244ba449ac4',
    u: 'e6db6867583030db3594c1a424b15f7c726624ec26b3353b10a903a6d0ab1c4c',
    output: 'c3da55379de9c6908e94ea4df28d084f32eccf03491c71f754b4075577a28552',
  },
  {
    // This one's input u-coordinate has its high bit set; RFC 7748 §5 requires
    // the implementation to mask it off, so the vector doubles as a check that
    // the library does.
    label: 'RFC 7748 §5.2 test vector #2',
    scalar: '4b66e9d4d1b4673c5ad22691957d6af5c11b6421e0ea01d42ca4169e7918ba0d',
    u: 'e5210f12786811d3f4b7959d0538ae2c31dbe7106fc03c3efc4cd549c715a493',
    output: '95cbde9476e8907d7aade45cb4b873f88b595a68799fa152e6f8f7647aac7957',
  },
]

/**
 * RFC 7748 §5.2's iterated test. The RFC publishes results after 1, 1,000 and
 * 1,000,000 iterations; the first two are run here and the millionth is not,
 * because it costs minutes of CI for no additional coverage of this lab's
 * claims. That omission is stated rather than quietly skipped.
 */
export const SECTION_5_2_ITERATED = {
  start: '0900000000000000000000000000000000000000000000000000000000000000',
  afterOne: '422c8e7a6227d7bca1350b3e2bb7279f7897b87bb6854b783c60e80311ae3079',
  afterOneThousand: '684cf59ba83309552800ef566f2f4d3c1c3887c49360e3875f2eb94d99532c51',
} as const

/**
 * RFC 7748 §6.1 — the worked Diffie-Hellman exchange, which is this lab's whole
 * subject. Alice's and Bob's private values, the two public values they send,
 * and the one shared secret both of them end up holding.
 */
export const SECTION_6_1_EXCHANGE = {
  alicePrivate: '77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a',
  alicePublic: '8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a',
  bobPrivate: '5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb',
  bobPublic: 'de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f',
  shared: '4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742',
} as const
