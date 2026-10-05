# Mutation evidence

**Written by `scripts/mutate.mjs run`, from the run it reports. Do not hand-edit it —
re-run instead.** A sentence describing a mutation cannot be replayed, and a paragraph
describing a run is the author's side of the claim rather than the run's.

- commit: `1b86e74c13fba24bac38e0d13b4b06e11df25b89`
- ran at: 2026-10-05T04:18:13.235Z
- suite: `npx playwright test e2e/verdicts.spec.ts e2e/claims.spec.ts e2e/verdict-coverage.spec.ts --reporter=list --retries=0`
- unmutated baseline: 22 tests passed

| mutation | file | verdict | markers killed | bundle |
|---|---|---|---|---|
| `comparison-always-identical` | `src/verify/compare.ts` | **KILLED** | guess-outcome, recovery-status | `82ee31789aa4` -> `a138978c6f34` -> `82ee31789aa4` |
| `comparison-always-different` | `src/verify/compare.ts` | **KILLED** | spec-vectors, shared-secret-match, identity-status | `82ee31789aa4` -> `93a8b9436e3f` -> `82ee31789aa4` |
| `eavesdropper-claims-recovery` | `src/eavesdrop/attempt.ts` | **KILLED** | recovery-status | `82ee31789aa4` -> `13d87e464944` -> `82ee31789aa4` |
| `zero-check-inverted` | `src/verify/zero-check.ts` | **KILLED** | zero-check, identity-status | `82ee31789aa4` -> `7e7411cec04a` -> `82ee31789aa4` |
| `agreement-ignores-the-peer` | `src/exchange/exchange.ts` | **KILLED** | shared-secret-match | `82ee31789aa4` -> `420fb4bdf506` -> `82ee31789aa4` |
| `impostor-substitutes-nothing` | `src/exchange/impostor.ts` | **KILLED** | identity-status | `82ee31789aa4` -> `fd305b375e99` -> `82ee31789aa4` |
| `guess-counter-stops-counting` | `src/ui/eavesdrop-panel.ts` | **KILLED** | guess-count | `82ee31789aa4` -> `daeee3912940` -> `82ee31789aa4` |
| `negative-claim-softened` | `src/ui/identity-panel.ts` | **KILLED** | negative-claim | `82ee31789aa4` -> `98d81f165309` -> `82ee31789aa4` |

8/8 mutations killed, covering 12 marker assertions.

The bundle column is rule 3: the built hash had to MOVE for the mutated code to have
reached the browser, and had to come back for the tree to be restored. The enforcement
that a recorded kill actually ran is `e2e/global-teardown.ts`, not this file.
