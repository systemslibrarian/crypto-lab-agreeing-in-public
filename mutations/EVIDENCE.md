# Mutation evidence

**Written by `scripts/mutate.mjs run`, from the run it reports. Do not hand-edit it —
re-run instead.** A sentence describing a mutation cannot be replayed, and a paragraph
describing a run is the author's side of the claim rather than the run's.

- commit: `19b9202b383d7dff17612f6204a787abc607329a`
- ran at: 2026-10-05T11:43:35.403Z
- suite: `npx playwright test e2e/verdicts.spec.ts e2e/claims.spec.ts e2e/verdict-coverage.spec.ts --reporter=list --retries=0`
- unmutated baseline: 29 tests passed

| mutation | file | verdict | markers killed | bundle |
|---|---|---|---|---|
| `comparison-always-identical` | `src/verify/compare.ts` | **KILLED** | guess-outcome, recovery-status | `d451e0893996` -> `bdf740f9c492` -> `d451e0893996` |
| `comparison-always-different` | `src/verify/compare.ts` | **KILLED** | spec-vectors, shared-secret-match, identity-status | `d451e0893996` -> `1d7d58d6e77b` -> `d451e0893996` |
| `eavesdropper-claims-recovery` | `src/eavesdrop/attempt.ts` | **KILLED** | recovery-status | `d451e0893996` -> `cb64025e31db` -> `d451e0893996` |
| `zero-check-inverted` | `src/verify/zero-check.ts` | **KILLED** | zero-check, identity-status | `d451e0893996` -> `4d5637b9708f` -> `d451e0893996` |
| `agreement-ignores-the-peer` | `src/exchange/exchange.ts` | **KILLED** | shared-secret-match | `d451e0893996` -> `b7c68eea6257` -> `d451e0893996` |
| `impostor-substitutes-nothing` | `src/exchange/impostor.ts` | **KILLED** | identity-status | `d451e0893996` -> `c981f773aaaf` -> `d451e0893996` |
| `guess-counter-stops-counting` | `src/ui/eavesdrop-panel.ts` | **KILLED** | guess-count | `d451e0893996` -> `af86a49c8979` -> `d451e0893996` |
| `negative-claim-softened` | `src/ui/identity-panel.ts` | **KILLED** | negative-claim | `d451e0893996` -> `b07f270f5b94` -> `d451e0893996` |
| `fresh-exchange-keeps-counting` | `src/ui/eavesdrop-panel.ts` | **KILLED** | guess-count | `d451e0893996` -> `c0f516d53560` -> `d451e0893996` |

9/9 mutations killed, covering 13 marker assertions.

The bundle column is rule 3: the built hash had to MOVE for the mutated code to have
reached the browser, and had to come back for the tree to be restored. The enforcement
that a recorded kill actually ran is `e2e/global-teardown.ts`, not this file.
