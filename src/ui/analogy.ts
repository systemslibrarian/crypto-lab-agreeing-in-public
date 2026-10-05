import {
  ALICE_COLOUR,
  ALICE_MIXTURE,
  BOB_COLOUR,
  BOB_MIXTURE,
  css,
  PUBLIC_COLOUR,
  SHARED_COLOUR,
  type Rgb,
} from './mixing.js'
import { clear, el } from './dom.js'

/**
 * Panel 1 — the picture first.
 *
 * Two people each start with a colour they keep, plus one colour everybody can
 * see. They mix, send the mixtures in the open, and mix again, and both land on
 * the same colour. Anyone watching has the two mixtures and no way to get there.
 *
 * Four rules this panel follows, all of them from §2 of the fleet standard:
 *
 *  - NO NUMBERS. Not a byte, not a length, nothing hex. The next panel is the
 *    real thing and this one is the picture; mixing the two is what makes a
 *    beginner think they have seen the mechanism when they have seen a drawing.
 *  - IT SAYS IT IS AN ANALOGY, in the panel, not in a footnote.
 *  - MOTION ONLY ON DEMAND. One press, one step. There is no timer and no idle
 *    animation, so a reader who stops reading sees a still picture, and a
 *    reader on `prefers-reduced-motion` gets the same four states with the
 *    colour transitions switched off by the stylesheet's own rule.
 *  - THE COLOUR IS NEVER THE ONLY CHANNEL. Every swatch carries a caption, the
 *    step is announced in a live region, and the conclusion is a sentence.
 */

interface Slot {
  readonly id: string
  readonly lane: 'alice' | 'wire' | 'bob'
  readonly colour: Rgb
  readonly caption: string
  readonly described: string
}

const SLOTS: readonly Slot[] = [
  {
    id: 'alice-own',
    lane: 'alice',
    colour: ALICE_COLOUR,
    caption: 'her own colour',
    described: 'Alice’s own colour, which she never sends',
  },
  {
    id: 'alice-mixture',
    lane: 'alice',
    colour: ALICE_MIXTURE,
    caption: 'her colour mixed into the public one',
    described: 'the mixture Alice made',
  },
  {
    id: 'alice-final',
    lane: 'alice',
    colour: SHARED_COLOUR,
    caption: 'what she ends up holding',
    described: 'the colour Alice ends up holding',
  },
  {
    id: 'wire-public',
    lane: 'wire',
    colour: PUBLIC_COLOUR,
    caption: 'the colour everyone can see',
    described: 'the public starting colour',
  },
  {
    id: 'wire-alice-mixture',
    lane: 'wire',
    colour: ALICE_MIXTURE,
    caption: 'the mixture Alice sent',
    described: 'the mixture Alice sent, in the open',
  },
  {
    id: 'wire-bob-mixture',
    lane: 'wire',
    colour: BOB_MIXTURE,
    caption: 'the mixture Bob sent',
    described: 'the mixture Bob sent, in the open',
  },
  {
    id: 'bob-own',
    lane: 'bob',
    colour: BOB_COLOUR,
    caption: 'his own colour',
    described: 'Bob’s own colour, which he never sends',
  },
  {
    id: 'bob-mixture',
    lane: 'bob',
    colour: BOB_MIXTURE,
    caption: 'his colour mixed into the public one',
    described: 'the mixture Bob made',
  },
  {
    id: 'bob-final',
    lane: 'bob',
    colour: SHARED_COLOUR,
    caption: 'what he ends up holding',
    described: 'the colour Bob ends up holding',
  },
]

interface Stage {
  readonly caption: string
  readonly visible: readonly string[]
  /** Shown only once the mixtures are in the open. */
  readonly watcher?: string
}

const STAGES: readonly Stage[] = [
  {
    caption:
      'Everyone starts. Alice has a colour she keeps to herself, Bob has his, and one colour is public — anyone can have it.',
    visible: ['alice-own', 'wire-public', 'bob-own'],
  },
  {
    caption:
      'Each of them stirs their own colour into the public one. Neither mixture gives away the colour that went into it.',
    visible: ['alice-own', 'alice-mixture', 'wire-public', 'bob-own', 'bob-mixture'],
  },
  {
    caption:
      'They send the mixtures to each other out in the open. Anyone watching now has both mixtures.',
    visible: [
      'alice-own',
      'wire-public',
      'wire-alice-mixture',
      'wire-bob-mixture',
      'bob-own',
    ],
    watcher: 'A watcher has these two mixtures, and the public colour. That is everything that was sent.',
  },
  {
    caption:
      'Each stirs their own colour into the mixture that arrived. Both are now holding equal parts of all three colours — so both are holding the same colour, and the watcher cannot stir it from what she has.',
    visible: [
      'alice-own',
      'alice-final',
      'wire-alice-mixture',
      'wire-bob-mixture',
      'bob-own',
      'bob-final',
    ],
    watcher: 'A watcher still has only the two mixtures. Her colours are the ones in the middle; neither is the one on either side of her.',
  },
]

const LANE_LABELS = { alice: 'Alice', wire: 'In the open', bob: 'Bob' } as const

export function analogyPanel(): HTMLElement {
  let stage = 0

  const caption = el('p', {
    class: 'analogy-caption',
    id: 'analogy-caption',
    role: 'status',
    'aria-live': 'polite',
  })
  const watcherNote = el('p', { class: 'analogy-watcher', id: 'analogy-watcher' })
  const board = el('div', { class: 'analogy-board' })
  const step = el(
    'button',
    { type: 'button', class: 'button button-primary', id: 'analogy-step' },
    ['Mix the next colour'],
  )
  const progress = el('p', { class: 'analogy-progress', id: 'analogy-progress' })

  const slotNodes = new Map<string, HTMLElement>()
  for (const lane of ['alice', 'wire', 'bob'] as const) {
    const column = el('div', { class: 'analogy-lane', 'data-lane': lane }, [
      el('h4', { class: 'analogy-lane-name' }, [LANE_LABELS[lane]]),
    ])
    for (const slot of SLOTS.filter((candidate) => candidate.lane === lane)) {
      const node = el('div', { class: 'analogy-slot', 'data-slot': slot.id }, [
        el('div', {
          class: 'analogy-swatch',
          role: 'img',
          'aria-label': slot.described,
          style: `background-color: ${css(slot.colour)}`,
        }),
        el('p', { class: 'analogy-swatch-caption' }, [slot.caption]),
      ])
      slotNodes.set(slot.id, node)
      column.append(node)
    }
    board.append(column)
  }

  function render(): void {
    const current = STAGES[stage]
    board.setAttribute('data-stage', String(stage))
    caption.textContent = current.caption
    progress.textContent = `Step ${stage + 1} of ${STAGES.length}`
    for (const [id, node] of slotNodes) node.hidden = !current.visible.includes(id)
    if (current.watcher) {
      watcherNote.textContent = current.watcher
      watcherNote.hidden = false
    } else {
      clear(watcherNote)
      watcherNote.hidden = true
    }
    const finished = stage === STAGES.length - 1
    step.textContent = finished ? 'Start the picture again' : 'Mix the next colour'
  }

  step.addEventListener('click', () => {
    stage = stage === STAGES.length - 1 ? 0 : stage + 1
    render()
  })

  render()

  return el('section', { class: 'band analogy-band', 'aria-labelledby': 'analogy-heading' }, [
    el('p', { class: 'eyebrow' }, ['Panel 1 — the picture first']),
    el('h2', { id: 'analogy-heading' }, ['Two colours nobody sends']),
    el('p', { class: 'analogy-lead' }, [
      'Before any of the real thing: a picture. This is an ',
      el('strong', {}, ['analogy']),
      ', not the mechanism — there are no numbers in it, and the next panel is the real exchange. ',
      'Read it for the shape of the trick: what gets sent, what never does, and why watching is not enough.',
    ]),
    el('div', { class: 'analogy', 'data-analogy': 'paint' }, [
      progress,
      caption,
      board,
      watcherNote,
      el('div', { class: 'analogy-controls' }, [step]),
    ]),
  ])
}
