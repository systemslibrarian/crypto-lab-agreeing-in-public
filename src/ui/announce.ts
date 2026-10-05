/**
 * One short, polite announcement per meaningful outcome.
 *
 * The results on this page are rendered into containers that get replaced
 * wholesale. Marking those containers as live regions would make a screen
 * reader read every byte strip, every hex value and every explanatory
 * paragraph each time one changed, which is worse than silence. So the
 * containers stay quiet and the outcome announces itself here, in one sentence
 * that names what happened and nothing else.
 *
 * Rules this keeps to:
 *  - never a byte value, never a count of bytes;
 *  - one sentence, written the way the verdict reads, not a transcript of it;
 *  - no focus is moved and nothing is scrolled, so it cannot fight the reader.
 */
export function announce(message: string): void {
  const region = document.querySelector<HTMLElement>('#announcer')
  if (!region) return
  // Reassigning identical text does not re-announce in some screen readers, so
  // clear first. The element is visually hidden, so this is never seen.
  region.textContent = ''
  region.textContent = message
}
