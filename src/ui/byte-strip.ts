import { shortHex } from '../x25519/bytes.js'
import { el } from './dom.js'

/**
 * 32 bytes drawn as 32 coloured cells.
 *
 * The strip exists so that "these are the same bytes" can be SEEN before it is
 * read: two strips side by side are either the same picture or they are not.
 * The colour is a direct function of the byte — hue only, so every byte value
 * is visually distinct and nothing is folded or hashed first. Two values
 * agreeing on their first bytes and differing later therefore look the same at
 * the start and diverge, which is the honest rendering.
 *
 * It carries no text. The cells are presentational children of a `role="img"`
 * with a name that says what the strip is and names its first bytes, and the
 * full value is one disclosure away as hex — so a reader who cannot use the
 * picture is not reading a worse page, and nothing here conveys an outcome by
 * colour alone (the verdict does that, in words).
 */
export function byteStrip(label: string, bytes: Uint8Array): HTMLElement {
  const strip = el('div', {
    class: 'byte-strip',
    role: 'img',
    'aria-label': `${label}: 32 bytes, beginning ${shortHex(bytes)}`,
  })
  for (const byte of bytes) {
    strip.append(
      el('span', {
        class: 'byte-cell',
        style: `background-color: hsl(${Math.round((byte * 360) / 256)} 62% 58%)`,
      }),
    )
  }
  return strip
}

/** The short prefix, as monospace text beside a strip. */
export function bytePrefix(bytes: Uint8Array): HTMLElement {
  return el('code', { class: 'byte-prefix' }, [`${shortHex(bytes)}…`])
}

