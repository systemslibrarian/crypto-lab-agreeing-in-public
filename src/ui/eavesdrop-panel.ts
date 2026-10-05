import { attemptRecovery } from '../eavesdrop/attempt.js'
import { transcriptOf } from '../eavesdrop/transcript.js'
import { KEYSPACE_DIGITS } from '../eavesdrop/keyspace.js'
import { generateKeyPair } from '../x25519/agree.js'
import { fromHex, toHex } from '../x25519/bytes.js'
import { byteStrip, bytePrefix } from './byte-strip.js'
import { announce } from './announce.js'
import { claim, clear, el, verdict } from './dom.js'
import type { Lab } from './state.js'
import type { Exchange } from '../exchange/exchange.js'

/** 32 bytes as hex. The prose and this number are cross-checked in the claims suite. */
const CANDIDATE_HEX_LENGTH = 64

/**
 * Panel 3 — what the eavesdropper has.
 *
 * Her transcript is shown IN FULL and read as ordinary, because that is the
 * point: nothing was hidden from her and it still is not enough. It separates
 * what was ALREADY PUBLIC from what was SENT, so the page does not imply a
 * third message that never existed, and the two private values sit behind an
 * explicitly labelled leak disclosure rather than beside the watcher's own
 * record — showing both in one breath was honest in its wording and
 * contradictory on the screen.
 *
 * Then she gets to try. The function that turns the transcript into the shared
 * secret needs a private value, and she has none, so the only move available is
 * to supply one and see — which is exactly what this panel lets the reader do,
 * against the real X25519 and the real comparison. The exercise is scoped to
 * guessing ALICE's private value, because every candidate is paired with the
 * value Bob sent and that is the pairing which would reproduce the secret; the
 * panel says so rather than implying either private value would do.
 *
 * The honest framing is on screen: not "this is impossible", but that no
 * practical method is known, and that this panel explores guessing rather than
 * every possible attack.
 */
export function eavesdropPanel(lab: Lab): HTMLElement {
  let attempts = 0
  let lastCandidate = ''

  const transcriptBody = el('div', { class: 'transcript-body', id: 'transcript-body' })
  const output = el('div', { class: 'eavesdrop-output', id: 'eavesdrop-output' })
  /**
   * Guidance, not results. It lives OUTSIDE #eavesdrop-output on purpose: that
   * element is one of the regions e2e/verdict-scan.ts holds to the rule that
   * every number inside it sits in a marker, and "you gave 12 characters" is a
   * measurement of what the reader typed rather than a measurement of the run.
   * Keeping the two apart means the rule can stay strict where it matters.
   */
  const notice = el('div', { class: 'eavesdrop-notice', id: 'eavesdrop-notice' })
  const waiting = el('p', { class: 'waiting-note', id: 'eavesdrop-waiting' }, [
    'Run the exchange in panel 2 first — there is nothing to listen to yet.',
  ])

  const input = el('input', {
    type: 'text',
    id: 'candidate-input',
    class: 'candidate-input',
    spellcheck: 'false',
    autocomplete: 'off',
    maxlength: CANDIDATE_HEX_LENGTH,
    placeholder: 'paste or roll a private value',
    'aria-describedby': 'candidate-help',
  })
  const roll = el('button', { type: 'button', class: 'button button-secondary', id: 'roll-button' }, [
    'Roll a random guess',
  ])
  const tryIt = el('button', { type: 'button', class: 'button button-primary', id: 'try-button' }, [
    'Try this value',
  ])

  function wireEntries(entries: readonly { label: string; value: string; note: string }[], extraClass = ''): HTMLElement {
    return el(
      'ul',
      { class: `wire-list ${extraClass}`.trim(), role: 'list' },
      entries.map((entry) =>
        el('li', { class: 'wire-entry', role: 'listitem' }, [
          el('span', { class: 'wire-label' }, [entry.label]),
          el('code', { class: 'full-hex' }, [entry.value]),
          el('span', { class: 'wire-note' }, [entry.note]),
        ]),
      ),
    )
  }

  function renderTranscript(exchange: Exchange): void {
    const transcript = transcriptOf(exchange)
    clear(transcriptBody)
    transcriptBody.append(
      el('h4', {}, ['Already public before they started']),
      wireEntries(transcript.alreadyPublic),
      el('h4', {}, ['Sent during this exchange']),
      wireEntries(transcript.sent),
      el('p', { class: 'wire-conclusion' }, [
        'That is the complete record. Two messages crossed the wire, and the shared secret is not ',
        'among them, because it was never sent. What Eve is missing is not a message — it is an ',
        'input: each side also used a private value that stayed on its own machine.',
      ]),
      // The private values are a LEAK, not part of the record, so they sit
      // behind a control the reader has to operate and a heading that says what
      // opening it means. Showing them inline beside "here is Eve's record" was
      // honest in its wording and contradictory on the screen -- the page said
      // "you are the watcher" and displayed both secrets in the same breath.
      el('details', { class: 'leak', id: 'leak-details' }, [
        el('summary', {}, ['Simulate a leak — reveal what a real watcher does not have']),
        el('div', { class: 'leak-body', id: 'leak-body' }, [
          el('p', { class: 'leak-note' }, [
            'Opening this is not an attack on the transcript above. It is a different situation: a ',
            'machine that was broken into, or an owner who was careless. Every role on this page is ',
            'simulated in your browser, so the page can show you these — a real watcher cannot.',
          ]),
          wireEntries(transcript.withheld, 'wire-list-withheld'),
        ]),
      ]),
    )
  }

  function renderIdle(): void {
    clear(notice)
    clear(output)
    output.append(
      verdict(
        'recovery-status',
        'idle',
        '—',
        'SHARED SECRET NOT RECOVERED',
        ['Nothing has been tried yet. Roll a guess, or paste a value of your own.'],
      ),
    )
  }

  function renderAttempt(exchange: Exchange, candidate: Uint8Array): void {
    attempts += 1
    const attempt = attemptRecovery(
      candidate,
      exchange.bob.publicValue,
      exchange.aliceSide.shared,
      attempts,
    )
    clear(notice)
    clear(output)
    output.append(
      el('div', { class: 'attempt-compare' }, [
        el('div', { class: 'secret-side' }, [
          el('h4', {}, ['What your guess produces']),
          byteStrip('The secret this guess produces', attempt.derived),
          bytePrefix(attempt.derived),
        ]),
        el('div', { class: 'secret-side' }, [
          el('h4', {}, ['What Alice and Bob are holding']),
          byteStrip('The real shared secret', exchange.aliceSide.shared),
          bytePrefix(exchange.aliceSide.shared),
        ]),
      ]),
      // Driven by the byte comparison, deliberately -- the verdict below is
      // driven by the recovery claim instead, so each has its own mutation.
      verdict(
        'guess-outcome',
        attempt.sameAsReal ? 'alarm' : 'pass',
        attempt.sameAsReal ? '!' : '≠',
        attempt.sameAsReal ? 'THE SAME 32 BYTES' : 'NOT THE SAME BYTES',
        attempt.sameAsReal
          ? [
              'This candidate produced the same secret. A value rolled at random will not; this happens ',
              'when the candidate is Alice’s own private value, or one X25519 treats as identical to it.',
            ]
          : [
              `The two values part company at byte ${attempt.firstDifferentByte}. Nearby guesses give you no "getting warmer" signal: a candidate that is almost right produces a result that is no closer than one that is completely wrong.`,
            ],
      ),
      verdict(
        'recovery-status',
        attempt.recovered ? 'alarm' : 'pass',
        attempt.recovered ? '!' : '✗',
        attempt.recovered ? 'SHARED SECRET RECOVERED' : 'SHARED SECRET NOT RECOVERED',
        attempt.recovered
          ? [
              'This is not an attack on the transcript. The candidate supplied the missing input directly, ',
              'which is what a leaked or stolen private value would do — a compromised machine, not a ',
              'recording. It is being told the answer rather than working it out.',
            ]
          : [
              'That is ',
              claim('guess-count', String(attempts), `${attempts} ${attempts === 1 ? 'guess' : 'guesses'}`),
              ' against this exchange, out of a space of private values ',
              `${KEYSPACE_DIGITS} digits long. Guessing is not a plan — but guessing is also not the `,
              'only thing an attacker could try, and this panel only explores guessing. The honest ',
              'statement about the rest is this: no practical method is known for computing this secret ',
              'from those two public values alone, assuming the private values were generated properly. ',
              'Not that it is impossible — that nobody has published a way.',
            ],
      ),
    )
    announce(
      attempt.recovered
        ? 'That candidate produced the shared secret.'
        : 'That candidate did not produce the shared secret.',
    )
  }

  function retire(reason: string): void {
    clear(notice)
    notice.append(el('p', { class: 'retired-note', id: 'retired-note' }, [reason]))
    clear(output)
    output.append(
      verdict('recovery-status', 'idle', '—', 'SHARED SECRET NOT RECOVERED', [
        'No attempt stands against the exchange now on the page.',
      ]),
    )
  }

  input.addEventListener('input', () => {
    const typed = input.value.trim().toLowerCase()
    // A no-op must not retire a standing result: re-typing the value that is
    // already there changes nothing, and §4.1b asks for that case by name.
    if (typed === lastCandidate) return
    lastCandidate = typed
    if (output.querySelector('[data-verdict="guess-outcome"]')) {
      retire('That attempt was retired when you changed the value. Press "Try this value" to run the new one.')
    }
  })

  roll.addEventListener('click', () => {
    input.value = toHex(generateKeyPair().privateValue)
    input.dispatchEvent(new Event('input'))
  })

  tryIt.addEventListener('click', () => {
    const exchange = lab.current()
    if (!exchange) return
    let candidate: Uint8Array
    try {
      candidate = fromHex(input.value)
    } catch {
      renderInvalid(
        'That is not hex. A private value is written as 64 characters, each one from 0-9 or a-f.',
      )
      return
    }
    if (candidate.length !== 32) {
      // Lead with the cause. A refusal that opens by restating the rule makes
      // the reader work out which rule they broke.
      renderInvalid(
        `That is not 32 bytes long. A private value is ${CANDIDATE_HEX_LENGTH} hex characters, and you gave ${candidate.length * 2}.`,
      )
      return
    }
    renderAttempt(exchange, candidate)
  })

  function renderInvalid(message: string): void {
    clear(notice)
    notice.append(el('p', { class: 'invalid-note', id: 'invalid-note' }, [message]))
    announce(`Nothing was run. ${message}`)
    clear(output)
    output.append(
      verdict('recovery-status', 'idle', '—', 'SHARED SECRET NOT RECOVERED', [
        'Nothing was run, because there was no value of the right length to run it with.',
      ]),
    )
  }

  lab.subscribe((exchange) => {
    renderTranscript(exchange)
    waiting.hidden = true
    transcriptBody.hidden = false
    input.disabled = false
    roll.disabled = false
    tryIt.disabled = false
    const hadAttempts = attempts > 0
    // The count is "guesses against THIS exchange", so a fresh exchange starts
    // it again. Carrying it over made the first guess against new key material
    // report "4 guesses" beside a secret it had never been tried against --
    // a number that was true of the session and false of the sentence holding it.
    attempts = 0
    if (hadAttempts) {
      retire('A fresh exchange replaced the one your last attempt was made against, so that attempt was retired and the count starts again.')
    } else {
      renderIdle()
    }
  })

  transcriptBody.hidden = true
  input.disabled = true
  roll.disabled = true
  tryIt.disabled = true
  renderIdle()

  return el('section', { class: 'band eavesdrop-band', 'aria-labelledby': 'eavesdrop-heading' }, [
    el('p', { class: 'eyebrow' }, ['Panel 3 — what the eavesdropper has']),
    el('h2', { id: 'eavesdrop-heading' }, ['Everything, and it is not enough']),
    el('p', { class: 'band-lead' }, [
      'Suppose somebody recorded the whole conversation. Not part of it — all of it, every value that was ',
      'sent, perfectly. Here is that recording, and here is what she can do with it.',
    ]),
    waiting,
    transcriptBody,
    el('div', { class: 'guess-box' }, [
      el('h4', {}, ['Let her try: guess Alice’s private value']),
      el('p', { id: 'candidate-help', class: 'guess-help' }, [
        'The function that turns this transcript into the shared secret needs a private value, and Eve ',
        'has neither of them. So the only move she has is to supply one and see. This exercise guesses ',
        el('strong', {}, ['Alice’s']),
        ' private value specifically, and combines each candidate with the value Bob sent — that is the ',
        'pairing that would reproduce the secret. (Guessing Bob’s would mean pairing it with Alice’s ',
        'value instead; one direction is enough to make the point.) A private value is 32 bytes, written ',
        'as 64 characters from 0-9 and a-f — roll one at random, or paste anything you like.',
      ]),
      el('div', { class: 'guess-controls' }, [
        el('label', { class: 'guess-label', for: 'candidate-input' }, ['Candidate private value']),
        input,
        el('div', { class: 'guess-buttons' }, [roll, tryIt]),
      ]),
      // Expert disclosure. A beginner does not need clamping to follow the
      // panel, but the page must not tell them something false on the way past
      // -- which is what "wrong by one bit is wrong by everything" was.
      el('details', { class: 'equivalents', id: 'equivalents-details' }, [
        el('summary', {}, ['Why some different candidates give the same answer']),
        el('p', {}, [
          'X25519 does not use the 32 bytes exactly as you type them. RFC 7748 §5 fixes five of the ',
          '256 bits before the value is used — three at one end, two at the other — so two candidates ',
          'differing only in those five bits are the same private value as far as the function is ',
          'concerned, and produce the same secret. Change the last bit of a working candidate and it ',
          'still works; that is this rule, not a weakness. It is also why the space of genuinely ',
          'distinct private values is smaller than 32 random bytes would suggest.',
        ]),
        el('p', {}, [
          'And the size of that space is not the same thing as the difficulty of the best known attack. ',
          'The figure usually quoted for X25519’s strength is lower than the size of the space, because ',
          'the best known attacks do better than trying every value. Neither number is on the main path ',
          'here, because neither changes what this panel demonstrates.',
        ]),
      ]),
    ]),
    notice,
    output,
  ])
}
