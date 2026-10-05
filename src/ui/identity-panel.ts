import { freshSubstitutedExchange } from '../exchange/impostor.js'
import { toHex } from '../x25519/bytes.js'
import { byteStrip, bytePrefix } from './byte-strip.js'
import { announce } from './announce.js'
import { clear, el, verdict } from './dom.js'

/**
 * Panel 4 — what the secret is for, and the one thing it is not.
 *
 * This panel carries the lab's NEGATIVE CLAIM (§4.1d), which is the belief a
 * beginner is most likely to leave with wrongly: *we agreed on a secret, so I
 * know who I agreed with.*
 *
 * It is demonstrated the only honest way — by letting the mechanism work
 * perfectly. Alice sets out to agree with Bob; somebody else's public value
 * arrives instead; Alice and that somebody end up holding the same 32 bytes.
 * Every check this page performs passes, and they are all listed so that can be
 * read rather than taken on trust. There is no failure code, and the absence of
 * one is the exhibit: X25519 has none to raise, because agreement was never a
 * claim about identity.
 *
 * The attack itself is handed on to crypto-lab-diffie-hellman-mitm rather than
 * built here. This panel's job is to establish that the gap is real.
 */
export function identityPanel(): HTMLElement {
  const output = el('div', { class: 'identity-output', id: 'identity-output' })
  output.hidden = true

  const substitute = el(
    'button',
    { type: 'button', class: 'button button-primary', id: 'impostor-button' },
    ['Let a stranger answer instead'],
  )

  substitute.addEventListener('click', () => {
    const run = freshSubstitutedExchange()
    clear(output)
    output.append(
      el('div', { class: 'secret-compare' }, [
        el('div', { class: 'secret-side' }, [
          el('h4', {}, ['What Alice is holding']),
          byteStrip('The secret Alice computed', run.aliceSide.shared),
          bytePrefix(run.aliceSide.shared),
          el('p', { class: 'secret-side-note' }, ['She believes she agreed with Bob.']),
        ]),
        el('div', { class: 'secret-side' }, [
          el('h4', {}, ['What the stranger is holding']),
          byteStrip('The secret the stranger computed', run.impostorSide.shared),
          bytePrefix(run.impostorSide.shared),
          el('p', { class: 'secret-side-note' }, ['Whoever actually answered. Not Bob.']),
        ]),
      ]),
      verdict(
        'identity-status',
        run.match ? 'pass' : 'alarm',
        run.match ? '=' : '≠',
        run.match
          ? 'THE SAME 32 BYTES — AND YOU DO NOT KNOW WHO WITH'
          : 'NOT THE SAME BYTES',
        run.match
          ? [
              el('p', {}, [
                'The exchange worked. It is ',
                // data-test, not data-claim: see src/ui/exchange-panel.ts.
                el(
                  'code',
                  {
                    class: 'claim',
                    'data-test': 'impostor-secret',
                    'data-value': toHex(run.aliceSide.shared),
                  },
                  [`${toHex(run.aliceSide.shared).slice(0, 16)}…`],
                ),
                ' on both sides — the same arrival panel 2 showed, reached the same way. Here is every ',
                'check this page performs, run against this exchange:',
              ]),
              el(
                'ul',
                { class: 'check-list', role: 'list', 'data-test': 'identity-checks' },
                run.checks.map((check) =>
                  el('li', { role: 'listitem' }, [
                    `${check.label}: ${check.passed ? 'PASS' : 'FAIL'}`,
                  ]),
                ),
              ),
              el('p', {}, [
                'Nothing failed, and nothing was going to. There is no failure code for this: X25519 has ',
                'none to raise, because agreement was never a claim about identity. Bob was not involved ',
                'at any point and does not find out.',
              ]),
            ]
          : [
              'The two sides did not match, which on a correct X25519 exchange cannot happen — if you are ',
              'reading this, something in this page is wrong.',
            ],
      ),
      // The negative claim is a rendered claim about what this construction
      // does NOT provide, so it carries a marker like any other: it is covered
      // by its own recorded mutation, and §4.1d's third assertion is an
      // assertion about a marker rather than about a loose paragraph. Its
      // state is `idle` rather than `alarm` because it reports no check -- in
      // this fixture every check passed, which is the whole exhibit.
      verdict(
        'negative-claim',
        'idle',
        '—',
        'WHAT THIS DOES NOT GIVE YOU',
        [
          'Agreeing on a secret tells you nothing about who you agreed with. Alice’s secret matches the ',
          'secret held by whoever sent the value she received, and nothing in the exchange says who that ',
          'was. Everything on this page is still true — it is just a smaller claim than it first looks.',
        ],
      ),
      el('p', { class: 'handoff' }, [
        'Making that into an attack, with somebody sitting in the middle holding one exchange with each ',
        'side, is the subject of ',
        el(
          'a',
          { href: 'https://systemslibrarian.github.io/crypto-lab-diffie-hellman-mitm/' },
          ['DH MITM'],
        ),
        '. The fix is not a better comparison: a full protocol has to authenticate the peer and bind ',
        'that authentication to this exchange, which is what signatures and certificates are for — ',
        el('a', { href: 'https://systemslibrarian.github.io/crypto-lab-https-padlock/' }, [
          'The HTTPS Padlock',
        ]),
        ' is where that gets settled.',
      ]),
    )
    output.hidden = false
    substitute.textContent = 'Try it with another stranger'
    announce(
      run.match
        ? 'The stranger exchange matched. Every check on the page passed, and who answered is still unknown.'
        : 'The stranger exchange did not match. Something on this page is wrong.',
    )
  })

  return el('section', { class: 'band identity-band', 'aria-labelledby': 'identity-heading' }, [
    el('p', { class: 'eyebrow' }, ['Panel 4 — what it buys, and what it does not']),
    el('h2', { id: 'identity-heading' }, ['What the secret is for']),
    el('p', { class: 'band-lead' }, [
      'Those 32 bytes are not the end of anything, and they are not quite a key either: they are ',
      el('strong', {}, ['shared secret material']),
      '. Real applications run them through a key-derivation step and encrypt the rest of the ',
      'conversation with what comes out — which is why both sides needed the same value and why ',
      'neither could afford to send it. That derivation step is not performed on this page.',
    ]),
    el('p', { class: 'band-lead' }, [
      'And now the part that is easy to walk away from this page believing wrongly. You might think: we ',
      'agreed on a secret, so I know who I agreed with. Press the button and watch what happens when ',
      'somebody else answers in Bob’s place.',
    ]),
    el('p', { class: 'band-note' }, [
      el('strong', {}, ['A separate example. ']),
      'This runs its own fresh exchange rather than continuing the one in panel 2 — a different Alice, ',
      'a different Bob, and somebody else answering. Nothing above is affected by pressing it.',
    ]),
    el('div', { class: 'band-controls' }, [substitute]),
    output,
  ])
}
