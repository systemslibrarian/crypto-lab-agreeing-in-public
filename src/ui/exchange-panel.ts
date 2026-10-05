import { toHex } from '../x25519/bytes.js'
import { checkSection52Vectors } from '../x25519/agree.js'
import { byteStrip, bytePrefix } from './byte-strip.js'
import { announce } from './announce.js'
import { clear, el, verdict } from './dom.js'
import type { Lab } from './state.js'
import type { Exchange } from '../exchange/exchange.js'

/**
 * Panel 2 — the real exchange.
 *
 * One press. Alice and Bob each take 32 random bytes, each computes the value
 * they publish, the two published values cross, and each combines the other's
 * with their own. The two results are then COMPARED, byte for byte, and the
 * comparison's own answer is what the page renders — src/exchange/exchange.ts
 * computes the two sides from what each party knows and nothing else, so the
 * two strips on screen are two computations rather than one value drawn twice.
 *
 * The moment the two secrets are shown equal is the whole lab, and it is built
 * to read as ARRIVAL rather than as a green pass badge: the same strip twice,
 * side by side, the same picture. There is no tick, no "SUCCESS", and the
 * colour that carries it is the accent rather than a success green.
 */
export function exchangePanel(lab: Lab): HTMLElement {
  const output = el('div', { class: 'exchange-output', id: 'exchange-output' })
  output.hidden = true

  const run = el(
    'button',
    { type: 'button', class: 'button button-primary', id: 'exchange-button' },
    ['Run the exchange'],
  )

  function render(exchange: Exchange): void {
    clear(output)
    const aliceSecret = exchange.aliceSide.shared
    const bobSecret = exchange.bobSide.shared

    output.append(
      el('div', { class: 'sent-values' }, [
        el('div', { class: 'sent-value' }, [
          el('h4', {}, ['Alice sends']),
          byteStrip('The value Alice sends', exchange.alice.publicValue),
          bytePrefix(exchange.alice.publicValue),
          el('p', { class: 'ownership' }, [
            'Made on Alice’s device from her private value and the public starting value.',
          ]),
        ]),
        el('div', { class: 'sent-value' }, [
          el('h4', {}, ['Bob sends']),
          byteStrip('The value Bob sends', exchange.bob.publicValue),
          bytePrefix(exchange.bob.publicValue),
          el('p', { class: 'ownership' }, [
            'Made on Bob’s device from his private value and the same public starting value.',
          ]),
        ]),
      ]),
      el('p', { class: 'crossing-note' }, [
        'Those two crossed in the open — the only things that did. Each tile above is one byte; the ',
        'colours are there so two values can be compared at a glance, and the words below say what the ',
        'comparison actually found. Each side now combines the value that arrived with the private ',
        'value it kept.',
      ]),
      el('div', { class: 'secret-compare', id: 'secret-compare' }, [
        el('div', { class: 'secret-side' }, [
          el('h4', {}, ['What Alice is holding']),
          byteStrip('The secret Alice computed', aliceSecret),
          bytePrefix(aliceSecret),
          el('p', { class: 'ownership' }, [
            'Computed on her device from ',
            el('strong', {}, ['her own private value']),
            ' and ',
            el('strong', {}, ['the value Bob sent']),
            '.',
          ]),
        ]),
        el('div', { class: 'secret-side' }, [
          el('h4', {}, ['What Bob is holding']),
          byteStrip('The secret Bob computed', bobSecret),
          bytePrefix(bobSecret),
          el('p', { class: 'ownership' }, [
            'Computed on his device from ',
            el('strong', {}, ['his own private value']),
            ' and ',
            el('strong', {}, ['the value Alice sent']),
            '.',
          ]),
        ]),
      ]),
      verdict(
        'shared-secret-match',
        exchange.match ? 'pass' : 'alarm',
        exchange.match ? '=' : '≠',
        exchange.match ? 'THE SAME 32 BYTES' : 'NOT THE SAME BYTES',
        exchange.match
          ? [
              'Two people who had never met, who sent each other nothing but the values above, are holding ',
              'the identical value. Neither sent it. Neither could have known it in advance. It is ',
              // Random key material, so this is a data-test hook rather than a
              // data-claim marker: a recorded mutation kill has to pin the exact
              // claim it asserts, and a value that differs every run cannot be
              // pinned. e2e/claims.spec.ts re-derives it independently instead.
              el('code', { class: 'claim', 'data-test': 'shared-secret', 'data-value': toHex(aliceSecret) }, [
                `${toHex(aliceSecret).slice(0, 16)}…`,
              ]),
              ' on both sides.',
            ]
          : [
              `The two sides diverge from byte ${exchange.firstDifferentByte}. On a correct X25519 exchange this cannot happen, so if you are reading this, something in this page is wrong.`,
            ],
      ),
      workingDisclosure(exchange),
    )
    output.hidden = false
    run.textContent = 'Run a fresh exchange'
    announce(
      exchange.match
        ? 'Exchange complete. Alice and Bob each computed a secret separately, and the page compared them: they are the same.'
        : 'Exchange complete, but the two sides did not agree. Something on this page is wrong.',
    )
  }

  run.addEventListener('click', () => render(lab.run()))

  return el('section', { class: 'band exchange-band', 'aria-labelledby': 'exchange-heading' }, [
    el('p', { class: 'eyebrow' }, ['Panel 2 — the real exchange']),
    el('h2', { id: 'exchange-heading' }, ['Now the real thing']),
    el('p', { class: 'band-lead' }, [
      'No colours from here on. This runs real X25519 — the key agreement in RFC 7748, the same one your ',
      'browser uses — in this page, on values generated in your browser a moment ago. Alice and Bob each ',
      'hold a private value of 32 random bytes, which neither of them ever sends. What they send is one ',
      'value each, in the clear. What they end up with is 32 bytes they both have and nobody sent.',
    ]),
    vectorCheck(),
    el('div', { class: 'band-controls' }, [run]),
    output,
  ])
}

/**
 * Before anything is run: does the function on this page agree with the
 * function in the specification?
 *
 * The numbers are RFC 7748 §5.2's own published vectors, the comparison is the
 * same one the headline verdict uses, and it runs in the reader's browser at
 * load. That makes "this is the real thing" a result rather than a promise,
 * which is the one claim a teaching demo cannot ask to be taken on trust.
 */
function vectorCheck(): HTMLElement {
  const results = checkSection52Vectors()
  const allMatch = results.every((result) => result.matches)
  return el('div', { class: 'vector-check', id: 'vector-check' }, [
    verdict(
      'spec-vectors',
      allMatch ? 'pass' : 'alarm',
      allMatch ? '✓' : '✗',
      allMatch ? 'MATCHES THE PUBLISHED EXAMPLES' : 'DOES NOT MATCH THE PUBLISHED EXAMPLES',
      [
        'A specification can publish worked examples with the answers already in them, so that anyone ',
        'can check an implementation against the same numbers. RFC 7748 §5.2 does. This page just ran ',
        'the real function against them in your browser, and ',
        allMatch
          ? 'got the published answer every time. That is checked here rather than asserted, because it is the one thing you would otherwise have to take on trust.'
          : 'did not get the published answer. Do not trust anything else on this page.',
      ],
    ),
  ])
}

/** The expert's half: every full value, and the check RFC 7748 §6.1 allows. */
function workingDisclosure(exchange: Exchange): HTMLElement {
  const aliceSecret = exchange.aliceSide.shared
  const neitherIsZero = !exchange.aliceSide.allZero && !exchange.bobSide.allZero
  return el('details', { class: 'working', id: 'working-details' }, [
    el('summary', {}, ['Show the working — every value in full']),
    el('div', { class: 'working-body', id: 'working-output' }, [
      row('Public starting value (fixed in RFC 7748 §4.1)', '0900… — the same for everyone'),
      row('Alice’s private value (never sent)', toHex(exchange.alice.privateValue)),
      row('Alice sends', toHex(exchange.alice.publicValue)),
      row('Bob’s private value (never sent)', toHex(exchange.bob.privateValue)),
      row('Bob sends', toHex(exchange.bob.publicValue)),
      row('What Alice computed', toHex(aliceSecret)),
      row('What Bob computed', toHex(exchange.bobSide.shared)),
      el('p', { class: 'working-note' }, [
        'In the notation RFC 7748 §6.1 uses, Alice sends X25519(a, 9), Bob sends X25519(b, 9), and both ',
        'end up holding X25519(a, X25519(b, 9)) = X25519(b, X25519(a, 9)). That line is the whole ',
        'specification of what this panel did.',
      ]),
      verdict(
        'zero-check',
        neitherIsZero ? 'pass' : 'alarm',
        neitherIsZero ? '✓' : '!',
        neitherIsZero ? 'NOT THE ALL-ZERO VALUE' : 'THE ALL-ZERO VALUE — ABORT',
        [
          'RFC 7748 §6.1 says both parties may check whether the result is the all-zero value and stop if ',
          'it is, because a peer who sends certain special values forces that result for everybody. This ',
          'page runs that check, and it is not expected to fire on an honest exchange — the library here ',
          'refuses such a value before it could. It is shown because doing this correctly includes it.',
        ],
      ),
    ]),
  ])
}

function row(label: string, value: string): HTMLElement {
  return el('div', { class: 'working-row' }, [
    el('span', { class: 'working-label' }, [label]),
    el('code', { class: 'full-hex' }, [value]),
  ])
}
