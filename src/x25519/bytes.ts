/** Byte and hex helpers. Nothing cryptographic lives here. */

export function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function fromHex(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase().replace(/\s+/g, '')
  if (!/^[0-9a-f]*$/.test(clean) || clean.length % 2 !== 0) {
    throw new Error(`not hex: ${hex.slice(0, 24)}`)
  }
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i += 1) out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  return out
}

/**
 * The first `count` bytes as hex — what a byte strip shows before the reader
 * opens the full value. A prefix, never a hash or a fold: two values that agree
 * on their first bytes and differ later must look the same here, because that is
 * what makes the full disclosure worth opening.
 */
export function shortHex(bytes: Uint8Array, count = 4): string {
  return toHex(bytes.slice(0, count))
}
