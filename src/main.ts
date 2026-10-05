import './styles.css'

import { analogyPanel } from './ui/analogy.js'
import { eavesdropPanel } from './ui/eavesdrop-panel.js'
import { el } from './ui/dom.js'
import { exchangePanel } from './ui/exchange-panel.js'
import { identityPanel } from './ui/identity-panel.js'
import { createLab } from './ui/state.js'

/**
 * Agreeing in Public — X25519 key agreement, for a reader who has not met it.
 *
 * The page is four panels in a fixed order, and the order is the argument: the
 * picture, then the real thing, then what an observer actually has, then what
 * the whole exercise does and does not buy. Plain language arrives before any
 * hex on every one of them, and the mathematics under X25519 is named and
 * handed on rather than taught here.
 */

function hero(): HTMLElement {
  return el('header', { class: 'cl-hero' }, [
    el('div', { class: 'cl-hero-main' }, [
      el('h1', { class: 'cl-hero-title' }, ['Agreeing in Public']),
      el('p', { class: 'cl-hero-sub' }, ['X25519 · RFC 7748 · key agreement']),
      el('p', { class: 'cl-hero-desc' }, [
        'Runs one real X25519 exchange and shows the two sides landing on the identical 32 bytes, beside ',
        'the complete transcript of everything that was sent.',
      ]),
    ]),
    el('aside', { class: 'cl-hero-why', 'aria-label': 'Why it matters' }, [
      el('span', { class: 'cl-hero-why-label' }, ['WHY IT MATTERS']),
      el('p', { class: 'cl-hero-why-text' }, [
        'Every secure connection you make starts with two strangers needing the same key and having no ',
        'private way to send it. This is how that is solved — in the open, in front of anyone watching, ',
        'billions of times a day.',
      ]),
    ]),
  ])
}

/**
 * The plain-language on-ramp: what this is and why it matters, before any hex,
 * any byte strip, or any control. §2 of the fleet standard calls this the
 * single highest-leverage fix, and this lab is pitched at a reader for whom it
 * is the whole entry point.
 */
function intro(): HTMLElement {
  return el('section', { class: 'band intro-band', 'aria-labelledby': 'intro-heading' }, [
    el('div', { class: 'intro-heading' }, [
      el('p', { class: 'eyebrow' }, ['Start here']),
      el('h2', { id: 'intro-heading' }, ['The problem, in one paragraph']),
    ]),
    el('div', { class: 'intro-copy' }, [
      el('p', {}, [
        'Two people want to talk privately. To scramble what they say, they both need the same secret ',
        'key. But they have never met, they share no password, and every way they have of reaching each ',
        'other is public — anything they send, anyone can read. So how does either of them get the key ',
        'to the other?',
      ]),
      el('p', {}, [
        'The answer, and it is genuinely surprising the first time: they do not send it. They each send ',
        'something else, in the clear, for anyone to see — and from those public messages they both ',
        'arrive at the same secret, which neither of them ever transmitted. Someone who recorded every ',
        'single message cannot work it out from what they have.',
      ]),
      el('p', {}, [
        'This page shows that happening three times over: once as a picture with coloured paint, once for ',
        'real with the actual cryptography your browser uses, and once from the eavesdropper’s chair so ',
        'you can see exactly what she is missing. There is no algebra on this page, and you do not need ',
        'any to follow it.',
      ]),
      el('p', { class: 'honesty-note' }, [
        el('strong', {}, ['Honest scoping: ']),
        'the cryptography here is real — real X25519, checked against the specification’s own published ',
        'vectors in your browser. The paint picture in panel 1 is an analogy and is labelled as one. This ',
        'is a teaching demo and not production cryptography: there is no authentication, no key schedule, ',
        'and no protocol around the exchange. Panel 4 is about what it does not prove.',
      ]),
    ]),
  ])
}

function sources(): HTMLElement {
  const link = (href: string, text: string): HTMLElement => el('a', { href }, [text])
  return el('section', { class: 'band sources-band', id: 'sources', 'aria-labelledby': 'sources-heading' }, [
    el('p', { class: 'eyebrow' }, ['Sources and where to go next']),
    el('h2', { id: 'sources-heading' }, ['Read further']),
    el('div', { class: 'sources-grid' }, [
      el('div', {}, [
        el('h3', {}, ['The specification']),
        el('ul', { role: 'list' }, [
          el('li', { role: 'listitem' }, [
            link('https://www.rfc-editor.org/rfc/rfc7748', 'RFC 7748'),
            ' — Elliptic Curves for Security. §4.1 fixes the starting value, §5.2 publishes the ',
            'vectors this page checks itself against, and §6.1 is the worked exchange panel 2 performs.',
          ]),
          el('li', { role: 'listitem' }, [
            link('https://github.com/paulmillr/noble-curves', '@noble/curves'),
            ' — the audited library this page calls for the X25519 operations themselves.',
          ]),
        ]),
      ]),
      el('div', {}, [
        el('h3', {}, ['Next in the Crypto Lab']),
        el('ul', { role: 'list' }, [
          el('li', { role: 'listitem' }, [
            link('https://systemslibrarian.github.io/crypto-lab-locks-and-keys/', 'Locks and Keys'),
            ' — the step before this one: what a public and a private value even are.',
          ]),
          el('li', { role: 'listitem' }, [
            link('https://systemslibrarian.github.io/crypto-lab-https-padlock/', 'The HTTPS Padlock'),
            ' — the step after: what the padlock in your address bar does and does not promise.',
          ]),
          el('li', { role: 'listitem' }, [
            link('https://systemslibrarian.github.io/crypto-lab-diffie-hellman-mitm/', 'DH MITM'),
            ' — panel 4’s gap turned into the actual attack, with the arithmetic on screen.',
          ]),
          el('li', { role: 'listitem' }, [
            link('https://systemslibrarian.github.io/crypto-lab-key-exchange/', 'Key Exchange'),
            ' — five generations of this idea, from 1976 to post-quantum hybrids.',
          ]),
          el('li', { role: 'listitem' }, [
            link('https://systemslibrarian.github.io/crypto-lab-what-is-pqc/', 'What is PQC'),
            ' — why the hard problem underneath this particular exchange is one a quantum computer ',
            'would undo, and what replaces it.',
          ]),
        ]),
      ]),
    ]),
  ])
}

function footer(): HTMLElement {
  return el('footer', { class: 'scripture-footer' }, [
    el('p', {}, [
      'So whether you eat or drink or whatever you do, do it all for the glory of God. — 1 Corinthians 10:31',
    ]),
  ])
}

const app = document.querySelector<HTMLElement>('#app')
if (!app) throw new Error('#app is missing from index.html')

const lab = createLab()
const shell = el('div', { class: 'shell' }, [
  hero(),
  intro(),
  analogyPanel(),
  exchangePanel(lab),
  eavesdropPanel(lab),
  identityPanel(),
  sources(),
])
app.append(shell, footer())
