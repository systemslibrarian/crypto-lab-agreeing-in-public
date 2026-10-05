/**
 * The colour arithmetic behind the paint picture.
 *
 * The picture is an analogy and the page says so. But an analogy that does not
 * have the property it is drawn to illustrate is a lie told in pictures, so the
 * mixing here is the one model that actually has it: a mixture is EQUAL PARTS
 * of the base colours that went into it, tracked as a multiset.
 *
 * That makes mixing commutative and associative in the way the story needs —
 * Alice adding her colour to Bob's mixture and Bob adding his to Alice's both
 * end at equal parts of all three, so both land on the SAME colour. The naive
 * alternative, averaging two mixtures pairwise, does not have this property:
 * it weights whoever mixed last twice as heavily, and the two sides would end
 * up visibly different while the page claimed they matched.
 *
 * src/ui/mixing.test.ts holds the picture to that property.
 */

export type Rgb = readonly [number, number, number]

/** The three starting colours. Chosen so all six swatches stay distinguishable. */
export const PUBLIC_COLOUR: Rgb = [0x38, 0xb2, 0xa8]
export const ALICE_COLOUR: Rgb = [0xf0, 0xc3, 0x3c]
export const BOB_COLOUR: Rgb = [0xb8, 0x5c, 0xd6]

/** Equal parts of everything handed in. Order cannot matter, and does not. */
export function combine(parts: readonly Rgb[]): Rgb {
  if (parts.length === 0) throw new Error('a mixture needs at least one colour')
  return [0, 1, 2].map((channel) =>
    Math.round(parts.reduce((total, part) => total + part[channel], 0) / parts.length),
  ) as unknown as Rgb
}

export function css(colour: Rgb): string {
  return `#${colour.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

/** What Alice sends: her colour and the public one, in equal parts. */
export const ALICE_MIXTURE = combine([PUBLIC_COLOUR, ALICE_COLOUR])
/** What Bob sends. */
export const BOB_MIXTURE = combine([PUBLIC_COLOUR, BOB_COLOUR])
/** Where both of them end up, by two different routes. */
export const SHARED_COLOUR = combine([PUBLIC_COLOUR, ALICE_COLOUR, BOB_COLOUR])

/**
 * What a watcher can work out from the public colour and the two mixtures.
 *
 * THIS IS THE REASON THE PICTURE IS ONLY A PICTURE, and it is computed here
 * rather than hedged in prose. Averaging is reversible: given the public colour
 * P and a mixture M = (P + X) / 2, anyone can recover X = 2M - P, and from both
 * recovered colours they can mix the final one themselves. So in the paint
 * story the watcher CAN reach the shared colour — exactly what X25519 does not
 * let her do, and the whole reason panel 2 exists.
 *
 * src/ui/mixing.test.ts asserts this succeeds. A test that proved the watcher
 * failed would be asserting something false about this arithmetic, and the
 * panel's copy is written against what this function actually returns.
 */
export function watcherReconstruction(
  publicColour: Rgb,
  aliceMixture: Rgb,
  bobMixture: Rgb,
): Rgb {
  const unmix = (mixture: Rgb): Rgb =>
    [0, 1, 2].map((channel) => 2 * mixture[channel] - publicColour[channel]) as unknown as Rgb
  return combine([publicColour, unmix(aliceMixture), unmix(bobMixture)])
}
