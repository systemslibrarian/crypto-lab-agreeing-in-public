/**
 * RFC 7748 §6.1's optional abort.
 *
 * The RFC says both parties MAY check whether the resulting shared value K is
 * the all-zero value and abort if it is. That check exists because a peer can
 * send a public value of low order, for which the function returns all zeros
 * for every private value — so an all-zero K is not a shared secret at all.
 *
 * @noble/curves performs that rejection one level down: `getSharedSecret`
 * THROWS rather than returning an all-zero result. This lab keeps its own check
 * anyway and reports it, for two reasons. It is the §6.1 behaviour named in a
 * place a reader can see, and it does not depend on a library promise that a
 * dependency bump could change. What it cannot do is fire on an honest
 * exchange, and the page says that in those words rather than implying a
 * near miss.
 */
export function isAllZero(bytes: Uint8Array): boolean {
  return bytes.every((byte) => byte === 0)
}
