/** The smallest element helper that keeps the panel code readable. */

type Attrs = Record<string, string | number | boolean | undefined>

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: readonly (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue
    if (value === true) node.setAttribute(name, '')
    else node.setAttribute(name, String(value))
  }
  for (const child of children) node.append(child)
  return node
}

export function clear(node: Element): void {
  while (node.firstChild) node.firstChild.remove()
}

/**
 * A rendered verdict.
 *
 * Every outcome this page states goes through here, which is what lets
 * e2e/verdict-scan.ts enumerate them from the DOM instead of from a list
 * somebody maintained by hand. Three things travel together on purpose: the
 * marker id, the rendered state (`data-result`), and an icon beside the words —
 * so the outcome is never carried by colour alone (WCAG 1.4.1), and a mutation
 * cannot flip the sentence while leaving the styling saying pass.
 */
export function verdict(
  id: string,
  result: 'pass' | 'alarm' | 'idle',
  icon: string,
  headline: string,
  detail: readonly (Node | string)[] = [],
): HTMLElement {
  return el('div', { class: 'verdict', 'data-verdict': id, 'data-result': result }, [
    el('p', { class: 'verdict-line' }, [
      el('span', { class: 'verdict-icon', 'aria-hidden': 'true' }, [icon]),
      el('span', { class: 'verdict-headline' }, [headline]),
    ]),
    // A div rather than a p: a verdict's detail sometimes carries a list (the
    // §4.1d fixture renders every check it performed), and a ul inside a p is
    // not valid HTML. It also keeps that list INSIDE the marker, which is what
    // exempts its "PASS" labels from e2e/verdict-scan.ts's outside-a-marker
    // rule -- those labels are part of the verdict, not a second one beside it.
    ...(detail.length ? [el('div', { class: 'verdict-detail' }, detail)] : []),
  ])
}

/**
 * A rendered measurement: the number a reader sees and the machine value beside
 * it, in one element, so a test can hold the page to both at once.
 */
export function claim(id: string, value: string, text: string): HTMLElement {
  return el('span', { class: 'claim', 'data-claim': id, 'data-value': value }, [text])
}
