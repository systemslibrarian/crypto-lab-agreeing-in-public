# Agreeing in Public

**X25519 · RFC 7748 · key agreement.** Two strangers who have never met end up holding the same
32 bytes, while an observer who saw every message sent holds nothing.

**Live demo:** https://systemslibrarian.github.io/crypto-lab-agreeing-in-public/

---

## What It Is

A browser-only teaching lab for **X25519 key agreement** as specified in
[RFC 7748](https://www.rfc-editor.org/rfc/rfc7748) — the curve Diffie–Hellman that your browser
runs before the first byte of a web page arrives. One real exchange is performed in the page,
with `@noble/curves` doing the curve arithmetic, and the two independently computed shared
secrets are compared byte for byte on screen.

It is written for someone who has not met key agreement before. **The page shows no modulus, no
exponent and no curve equation, and it never uses the words "discrete logarithm"** — plain
language arrives before any hex, and the mathematics underneath is named and handed on to
[DH MITM](https://systemslibrarian.github.io/crypto-lab-diffie-hellman-mitm/) and
[Key Exchange](https://systemslibrarian.github.io/crypto-lab-key-exchange/) rather than taught
here. Simplifying the explanation, not the cryptography: every value on the page is real.

The security model is deliberately small, and the lab says so in the page as well as here.
X25519 key agreement gives two parties the same secret without either sending it. It gives them
**nothing about who they agreed with** — and panel 4 is an exhibit that demonstrates that rather
than a disclaimer that asserts it. There is no authentication here, no key schedule, and no
protocol around the exchange. **This is not production cryptography.**

What is real: the X25519 operations, the key generation (the browser's own CSPRNG), the
byte-for-byte comparison, the RFC 7748 §6.1 all-zero check, and the RFC 7748 §5.2 vector check
that runs in the reader's browser at page load. What is an analogy: the coloured-paint picture
in panel 1, which carries no numbers and is labelled an analogy in the panel itself.

## Exhibits

1. **The picture first.** Two people each start with a colour they keep and one colour everyone
   can see. They mix, send the mixtures in the open, and mix again — and land on the same colour
   that a watcher cannot stir from the two mixtures she has. Four stages, advanced one press at
   a time; no numbers anywhere in it. The mixing model is equal parts of the base colours, which
   is the one model that actually has the property the picture is drawn to illustrate, and
   `src/ui/mixing.test.ts` holds it to that.

2. **The real exchange.** Before anything is pressed, the page runs RFC 7748 §5.2's published
   vectors through the real function in your browser and reports the result — so "this is the
   real thing" is a measurement rather than a promise. Then one press: Alice and Bob each take
   32 random bytes, each computes the value they publish, the two published values cross, and
   each combines the other's with their own. **The two results are compared byte for byte and
   the comparison's own answer is what is rendered.** The two sides are computed in separate
   functions from only what each party knows, so the two identical byte strips on screen are two
   computations rather than one value drawn twice. "Show the working" discloses every value in
   full, states the exchange in RFC 7748 §6.1's own notation, and reports the §6.1 all-zero check.

3. **What the eavesdropper has.** The complete transcript — the starting value and both published
   values — shown as ordinary and complete, with both private values named as withheld rather
   than quietly omitted. Then you can **try to break it yourself against the real primitive**:
   roll or paste a candidate private value, and the page runs the same X25519 and the same
   comparison, and reports what it measured. The framing is honest: not "this is impossible", but
   that nobody knows a way and the whole of modern key exchange rests on that. Supply one of the
   two real private values and the panel reports recovery — the verdict is wired to a measurement,
   not to a constant.

4. **What the secret is for, and the one thing it is not.** The shared secret becomes the key that
   encrypts the rest of the conversation. Then the negative claim, built rather than asserted:
   Alice sets out to agree with Bob, somebody else's public value arrives instead, and Alice and
   that somebody land on the same 32 bytes. **Every check the page performs passes, and they are
   all listed so that can be read rather than taken on trust.** There is no failure code, and the
   absence of one is the exhibit. The attack itself is handed on to DH MITM.

## When to Use It

- **Use it to see that a shared secret can be built in public**, because the two byte strips are
  computed independently and shown identical, beside a transcript that demonstrably does not
  contain them.
- **Use it as the step between "you have a pair of keys" and "your browser has a secure
  connection"**, because that step is the one a newcomer is usually asked to take on faith.
- **Use it to understand what key agreement does not buy**, because panel 4 reaches a state where
  every check reports success and the reader still does not know who they agreed with.
- **Do NOT use it as a model for real key agreement code.** It has no authentication, derives no
  keys from the shared secret, and has no protocol, transcript binding or replay protection around
  it. It is a demo app and does not provide hardened operational controls.

## Live Demo

https://systemslibrarian.github.io/crypto-lab-agreeing-in-public/

Run the exchange and watch the two byte strips arrive identical. Open "show the working" for every
value in full. Then roll a guess at the eavesdropper's panel and watch the real X25519 refuse it,
and press "Let a stranger answer instead" to reach the state where everything passes and identity
is still unknown. Everything runs in your browser; nothing is sent anywhere, and no key material
is stored.

## What Can Go Wrong

- **Mistaking agreement for authentication.** This is the big one, and it is why panel 4 exists.
  Alice's secret matches the secret held by whoever sent the value she received. Nothing in X25519
  says who that was, and there is no error code when it is not who she expected.
- **Trusting the analogy too far.** Equal-parts paint mixing has the commutativity the story needs
  and nothing else about X25519. It is labelled an analogy in the panel, and panel 2 is the real
  thing on purpose.
- **A public value of low order.** RFC 7748 §6.1 notes that both parties may check whether the
  resulting value is all-zero and abort. The lab performs that check and reports it;
  `@noble/curves` additionally refuses such a value before an all-zero result could be returned,
  which `src/x25519/agree.test.ts` measures rather than assumes.
- **Reusing a private value forever.** Nothing here rotates anything. Forward secrecy comes from
  generating a fresh pair per session, which is what "ephemeral" means in ECDHE; this lab
  generates a fresh pair per press and says nothing stronger.
- **Reading the shared secret as a key.** In practice it is run through a KDF before anything uses
  it. That step is out of scope here and is not performed.

## Real-World Usage

X25519 is the key agreement in TLS 1.3, in SSH, in WireGuard, in Signal's X3DH and PQXDH, and in
the `age` file encryption format. The exchange in panel 2 is the same operation, with the same
base point, that your browser performs on essentially every HTTPS connection it makes. RFC 7748
§6.1's worked example is reproduced exactly by `src/exchange/exchange.test.ts`.

## How to Run Locally

```bash
npm install
npm run dev          # http://localhost:5173/crypto-lab-agreeing-in-public/
```

```bash
npm run build        # tsc -b && vite build
npm run preview      # serves dist/ on port 4731
```

## Related Demos

- [Locks and Keys](https://systemslibrarian.github.io/crypto-lab-locks-and-keys/) — the step
  before this one: what a public and a private value even are.
- [The HTTPS Padlock](https://systemslibrarian.github.io/crypto-lab-https-padlock/) — the step
  after: what the padlock in your address bar does and does not promise.
- [DH MITM](https://systemslibrarian.github.io/crypto-lab-diffie-hellman-mitm/) — panel 4's gap
  turned into the actual attack, with the arithmetic on screen.
- [Key Exchange](https://systemslibrarian.github.io/crypto-lab-key-exchange/) — five generations
  of this idea, from 1976 to post-quantum hybrids.
- [What is PQC](https://systemslibrarian.github.io/crypto-lab-what-is-pqc/) — why the hard problem
  under this exchange is one a quantum computer would undo.

## Build & Verify

```bash
npm test             # 60 unit tests, 8 files
npm run test:a11y    # the WCAG 2.1 AA gate and the claims suite, 25 browser tests
npm run test:verdicts # the verdict, claims and marker-coverage suites
npm run test:mutation # applies every recorded mutation and judges each result
```

**Known-answer tests.** `src/x25519/vectors.ts` holds the RFC 7748 numbers, copied by section with
nothing recomputed; `src/x25519/agree.test.ts` runs them. Both §5.2 single-multiplication vectors
pass, as do the iterated results after 1 and after 1,000 iterations — the RFC's 1,000,000-iteration
result is **not** run, because it costs minutes of CI and covers nothing further that this lab
claims, and that omission is recorded in the file rather than left silent. RFC 7748 §6.1's worked
exchange is reproduced end to end, in both directions. The round-trip tests carry a **negative
control** of equal weight: across 50 mismatched pairings the two sides must *not* agree, because a
round-trip test on its own passes against an implementation that returns a constant.

**Accessibility.** `@axe-core/playwright` scans the production build for zero WCAG 2.1 A/AA
violations across every state a reader can reach, at **1280px, 390px and 320px**. The gate asserts
axe's `incomplete` bucket as well as its violations, computes text contrast arithmetically
alongside axe, measures non-text contrast per border side, and sets `prefers-reduced-motion`
through `emulateMedia` before navigation and then asserts from inside the page that it took
effect. Nothing is injected into the page and no panel is revealed from script — every state is
reached by operating the control a reader would operate. `e2e/nontext-baseline.ts` is empty, which
is the terminal state of its ratchet rather than an unrun check.

**Claims.** `e2e/claims.spec.ts` checks that the page tells the truth, by **re-deriving** its
claims from the page's own raw inputs through the library directly rather than by re-running the
source's own expression — a test that only checks the page agrees with itself passes a mutation
that corrupts the maths, because the corrupted value is reported consistently everywhere. It also
covers the §4.1d negative claim: the fixture is reached through the interface, every rendered check
is asserted to report success, and the limitation is asserted to be visible in that same state and
not behind a disclosure.

**Mutation testing.** Every outcome the page renders carries a `data-verdict` marker and every
number it reports about a run carries a `data-claim` marker; `e2e/verdict-coverage.spec.ts` fails
if the page renders a marker no recorded mutation covers, if a mutation names a marker the page
never renders, or if a mutation's anchor no longer matches its source. `node scripts/mutate.mjs
run` applies each mutation in an isolated `git archive HEAD` tree and judges the result against
four rules — the owning test passed unmutated in the same run, the patch changed the file, the
built bundle's hash moved *and* the failure was not a build error or a dead server, and the
failure was that marker's own assertion. **A patch that does not compile is `DOES NOT BUILD` and
is never a kill.** The results in `mutations/EVIDENCE.md` are written by that script from the run
it reports; nothing there is typed. Separately, `e2e/global-teardown.ts` fails the suite when a
kill recorded in the registry never actually executed, so an unperformed record cannot sit there
looking performed.

## Performance

Everything is a handful of curve operations and renders instantly; there is nothing to benchmark.
The one deliberately slow thing is the 1,000-iteration RFC 7748 §5.2 test, which runs in well
under a second.

---

*One of the browser demos in the [Crypto Lab](https://crypto-lab.systemslibrarian.dev/) suite.*

*"So whether you eat or drink or whatever you do, do it all for the glory of God." — 1 Corinthians 10:31*
