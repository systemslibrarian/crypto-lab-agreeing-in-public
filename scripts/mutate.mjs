#!/usr/bin/env node
// Applies, reverts, or JUDGES the section 4.1c mutations in
// e2e/verdict-mutations.json.
//
//   node scripts/mutate.mjs list
//   node scripts/mutate.mjs apply <id>
//   node scripts/mutate.mjs revert <id>
//   node scripts/mutate.mjs run [id...]      <- the judging loop
//
// WHY A JUDGING LOOP AND NOT JUST apply/revert
//
// apply/revert leaves the judgement to a person, and the judgement is the part
// that goes wrong. A mutated run can go red for reasons that are not the
// verdict: a build error, a server that never started, a port answered by an
// unmutated checkout. Each of those looks exactly like a kill in a terminal and
// is not one. Worse, a patch whose anchor no longer matches applies nothing at
// all, the suite stays green, and "the mutation survived" is indistinguishable
// from "the harness does not bite".
//
// THE FOUR RULES A KILL HAS TO CLEAR, all enforced below:
//
//   1. the owning test PASSED unmutated, in this same run;
//   2. the patch actually CHANGED the file (anchor unique, bytes different);
//   3. the run served the MUTATED code -- proved two ways, because one is not
//      enough: the built bundle's hash must move, AND the failure must not
//      match a shape that means the code never ran at all;
//   4. the failure is that marker's OWN assertion, not the suite going red.
//
// A patch that does not compile is DOES NOT BUILD and is never a kill. Fix the
// patch -- `|| true` rather than deleting a used local -- and re-run.
//
// The run happens in an isolated `git archive HEAD` tree with node_modules
// symlinked, so nothing is judged against the working copy and a crash cannot
// strand an inverted condition in a file that also holds real work. CI=1 forces
// playwright.config.ts's `reuseExistingServer: !process.env.CI` to false, so
// port 4731 cannot be answered by a server an earlier, unmutated run left up.
//
// WHAT IT WRITES, AND WHY THAT IS THE POINT
//
// Every record under mutations/ is written by this script from the run it just
// performed. None of it is typed. A sentence describing a mutation cannot be
// replayed, and a paragraph describing a run is the author's side of the claim
// rather than the run's -- so the ledger is a machine record stamped with the
// commit it came from.
//
// That archive is a convenience, not the enforcement. The enforcement is
// e2e/global-teardown.ts, which fails the suite when a kill recorded in
// verdict-mutations.json never actually executed -- so an unperformed record
// cannot sit in the registry looking performed, whether or not anyone runs
// this script.

import { execFileSync, execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url)).replace(/\/$/, '')
const registry = JSON.parse(readFileSync(join(root, 'e2e', 'verdict-mutations.json'), 'utf8'))
const [command, ...rest] = process.argv.slice(2)

if (command === 'list' || !command) {
  for (const [key, entry] of Object.entries(registry.mutations)) {
    console.log(`${key}\n  ${entry.file}`)
    for (const [marker, kill] of Object.entries(entry.kills ?? {})) {
      console.log(`  kills ${marker} in: ${kill.test}`)
    }
    console.log(`  ${entry.why}\n`)
  }
  process.exit(0)
}

/* ---- apply / revert: one edit, in the working tree ----------------------- */
if (command === 'apply' || command === 'revert') {
  const id = rest[0]
  const entry = registry.mutations[id]
  if (!entry) {
    console.error(`unknown mutation: ${id}`)
    process.exit(2)
  }
  const path = join(root, entry.file)
  const source = readFileSync(path, 'utf8')
  const [from, to] = command === 'apply' ? [entry.find, entry.replace] : [entry.replace, entry.find]
  const occurrences = source.split(from).length - 1
  if (occurrences !== 1) {
    console.error(`refusing: ${entry.file} matched ${occurrences}x, want exactly 1`)
    process.exit(2)
  }
  writeFileSync(path, source.replace(from, to))
  console.log(`${command} ${id} -> ${entry.file}`)
  process.exit(0)
}

if (command !== 'run') {
  console.error(`unknown command: ${command}. Try list, apply, revert or run.`)
  process.exit(2)
}

/* ---- run: the judging loop ---------------------------------------------- */

const ids = rest.length ? rest : Object.keys(registry.mutations)
const unknown = ids.filter((id) => !registry.mutations[id])
if (unknown.length) {
  console.error(`unknown mutation(s): ${unknown.join(', ')}`)
  process.exit(2)
}

const git = (...a) => execFileSync('git', ['-C', root, ...a], { encoding: 'utf8' }).trim()

// `git archive HEAD` cannot see uncommitted work, so a dirty tree would produce
// results about a tree nobody has.
const dirty = git('status', '--porcelain', '--untracked-files=no')
if (dirty && !process.env.MUTATION_ALLOW_DIRTY) {
  console.error('Refusing to run: uncommitted changes to tracked files.\n')
  console.error(dirty)
  console.error('\nThe isolated tree is archived from HEAD and would not contain them.')
  console.error('Commit first. MUTATION_ALLOW_DIRTY=1 overrides, knowing that.')
  process.exit(2)
}
const sha = git('rev-parse', 'HEAD')

/* Rule 2, checked for every selected patch BEFORE any is applied. An
   unreversible patch strands a mutated file and turns every later result into a
   verdict about that file rather than about its own mutation. */
const invalid = []
for (const id of ids) {
  const entry = registry.mutations[id]
  const text = readFileSync(join(root, entry.file), 'utf8')
  const anchors = text.split(entry.find).length - 1
  if (anchors !== 1) {
    invalid.push(`${id}: find occurs ${anchors} times in ${entry.file}, expected 1`)
    continue
  }
  const after = text.replace(entry.find, entry.replace)
  if (after === text) invalid.push(`${id}: the patch is a no-op, it would not change ${entry.file}`)
  else if (after.split(entry.replace).length - 1 !== 1) {
    invalid.push(`${id}: replace occurs more than once after applying, so it cannot be reverted`)
  }
}
if (invalid.length) {
  console.error('Refusing to run: these patches cannot make the round trip.\n')
  for (const line of invalid) console.error(`  ${line}`)
  process.exit(2)
}

const TREE = mkdtempSync(join(tmpdir(), 'agreeing-mutation-'))
console.log(`isolated tree: ${TREE}`)
console.log(`archived from: ${sha.slice(0, 7)}`)
console.log(`${ids.length} patches make the round trip.\n`)
execSync(`git -C ${root} archive HEAD | tar -x -C ${TREE}`, { stdio: 'pipe' })
symlinkSync(join(root, 'node_modules'), join(TREE, 'node_modules'))

const sh = (cmd) =>
  execSync(cmd, {
    cwd: TREE,
    stdio: 'pipe',
    encoding: 'utf8',
    env: { ...process.env, CI: '1' },
    maxBuffer: 64 * 1024 * 1024,
  })

const DIST = join(TREE, 'dist', 'assets')
function bundleHash() {
  if (!existsSync(DIST)) return null
  const h = createHash('sha256')
  for (const f of readdirSync(DIST).sort()) h.update(f).update(readFileSync(join(DIST, f)))
  return h.digest('hex').slice(0, 12)
}
const md5 = (rel) =>
  createHash('md5').update(readFileSync(join(TREE, rel))).digest('hex').slice(0, 12)

function build() {
  try {
    sh('npm run build')
    return true
  } catch {
    return false
  }
}

const ANSI = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g')
const strip = (s) => String(s).replace(ANSI, '')

/** Rule 3's second half. Red for one of these reasons means the code never ran. */
const NOT_A_KILL = [
  { pattern: /error TS\d+|Build failed|Transform failed|Could not resolve/i, label: 'build error' },
  {
    pattern: /webServer.*did not start|Timeout .* exceeded while running "beforeAll"/i,
    label: 'server never started',
  },
  { pattern: /net::ERR_CONNECTION_REFUSED/i, label: 'nothing served on the port' },
]
const notAKill = (output) =>
  NOT_A_KILL.find(({ pattern }) => pattern.test(strip(output)))?.label ?? null

/* The WHOLE suite, never `-g` on one test.
 *
 * e2e/global-teardown.ts fails the run when any recorded kill in
 * verdict-mutations.json did not execute, which is what makes an unperformed
 * record impossible to leave lying around. A single-test run therefore CANNOT
 * exit 0 here: the named test passes and the teardown fails on all the others.
 * So the suite runs whole, once per phase, and the per-test answer is read out
 * of the reporter. */
const SUITE =
  'npx playwright test e2e/verdicts.spec.ts e2e/claims.spec.ts e2e/verdict-coverage.spec.ts --reporter=list --retries=0'

function runSuite() {
  try {
    return { failed: false, output: sh(SUITE) }
  } catch (err) {
    return { failed: true, output: `${err.stdout ?? ''}${err.stderr ?? ''}` }
  }
}

/** Failing test titles, as the list reporter prints them: `  N) path:line > title`. */
function failingTitles(output) {
  return [...strip(output).matchAll(/^\s*\d+\)\s+(.+?)\s*$/gm)].map((m) =>
    m[1].replace(/[\s─-]+$/, '').trim(),
  )
}

function apply(entry, forward) {
  const [from, to] = forward ? [entry.find, entry.replace] : [entry.replace, entry.find]
  const path = join(TREE, entry.file)
  const before = readFileSync(path, 'utf8')
  if (before.split(from).length - 1 !== 1) throw new Error(`${entry.file}: anchor no longer unique`)
  const after = before.replace(from, to)
  if (after === before) throw new Error('the patch produced an identical file: it did not apply')
  writeFileSync(path, after)
}

console.log('building the baseline in the isolated tree...')
if (!build()) {
  console.error('The baseline build fails in the isolated tree. Nothing below would mean anything.')
  rmSync(TREE, { recursive: true, force: true })
  process.exit(2)
}
const baselineHash = bundleHash()
console.log(`baseline bundle ${baselineHash}\n`)

console.log('running the unmutated baseline suite...')
const baseline = runSuite()
if (baseline.failed) {
  console.error('The unmutated suite does not pass in the isolated tree. Nothing below would mean')
  console.error('anything: a mutation "caught" by an already-red suite is caught by nothing.\n')
  console.error(strip(baseline.output).split('\n').slice(-25).join('\n'))
  rmSync(TREE, { recursive: true, force: true })
  process.exit(2)
}
const baselineCount = (strip(baseline.output).match(/(\d+)\s+passed/) || [])[1] ?? '?'
console.log(`baseline suite PASSED (${baselineCount} tests)\n`)

const results = []
for (const id of ids) {
  const entry = registry.mutations[id]
  const markers = Object.entries(entry.kills ?? {})
  process.stdout.write(`${id.padEnd(32)} `)
  try {
    const beforeMd5 = md5(entry.file)
    apply(entry, true)
    const built = build()
    const mutatedHash = built ? bundleHash() : null
    const mutated = built ? runSuite() : { failed: false, output: '' }
    const failed = built ? failingTitles(mutated.output) : []
    const runs = markers.map(([marker, k]) => [
      marker,
      { failed: failed.some((t) => t.includes(k.test)), output: mutated.output },
    ])
    apply(entry, false)
    build()
    const restoredHash = bundleHash()
    if (md5(entry.file) !== beforeMd5) {
      console.log('NOT RESTORED')
      console.error(`\n${id}: ${entry.file} did not return to md5 ${beforeMd5}. Aborting.`)
      rmSync(TREE, { recursive: true, force: true })
      process.exit(2)
    }

    const shapes = runs.map(([, r]) => notAKill(r.output)).filter(Boolean)
    const survived = runs.filter(([, r]) => !r.failed).map(([m]) => m)
    const wrongName = runs
      .filter(([m, r]) => r.failed && !strip(r.output).includes(m))
      .map(([m]) => m)

    const verdict = !built
      ? 'DOES NOT BUILD'
      : mutatedHash === baselineHash
        ? 'BUNDLE UNCHANGED'
        : shapes.length
          ? `NOT A KILL (${shapes[0]})`
          : survived.length
            ? `SURVIVED (${survived.join(', ')})`
            : wrongName.length
              ? `FAILED FOR THE WRONG REASON (${wrongName.join(', ')})`
              : restoredHash !== baselineHash
                ? 'NOT RESTORED'
                : 'KILLED'
    results.push({
      id,
      verdict,
      file: entry.file,
      markers: markers.map(([m]) => m),
      baselineHash,
      mutatedHash,
      restoredHash,
      failingTests: failed,
    })
    console.log(
      verdict === 'KILLED'
        ? `KILLED  ${baselineHash} -> ${mutatedHash} -> ${restoredHash}  markers: ${markers
            .map(([m]) => m)
            .join(', ')}`
        : verdict,
    )
  } catch (err) {
    console.log(`ERROR  ${err.message}`)
    console.error(
      '\nAborting: a mutated file left in place makes every later verdict a statement about it.',
    )
    rmSync(TREE, { recursive: true, force: true })
    process.exit(2)
  }
}

rmSync(TREE, { recursive: true, force: true })

/* ---- the evidence, written by the thing that ran it ---------------------- */

const bad = results.filter((r) => r.verdict !== 'KILLED')
const covered = results.reduce((n, r) => n + r.markers.length, 0)
const when = new Date().toISOString()
mkdirSync(join(root, 'mutations'), { recursive: true })
writeFileSync(
  join(root, 'mutations', 'evidence.json'),
  `${JSON.stringify(
    {
      generatedBy: 'scripts/mutate.mjs run',
      note: 'Machine-written from the run it reports. Do not hand-edit; re-run instead.',
      commit: sha,
      ranAt: when,
      suite: SUITE,
      baselineTestsPassed: baselineCount,
      observed: results,
    },
    null,
    2,
  )}\n`,
)
writeFileSync(
  join(root, 'mutations', 'EVIDENCE.md'),
  [
    '# Mutation evidence',
    '',
    '**Written by `scripts/mutate.mjs run`, from the run it reports. Do not hand-edit it —',
    're-run instead.** A sentence describing a mutation cannot be replayed, and a paragraph',
    "describing a run is the author's side of the claim rather than the run's.",
    '',
    `- commit: \`${sha}\``,
    `- ran at: ${when}`,
    `- suite: \`${SUITE}\``,
    `- unmutated baseline: ${baselineCount} tests passed`,
    '',
    '| mutation | file | verdict | markers killed | bundle |',
    '|---|---|---|---|---|',
    ...results.map(
      (r) =>
        `| \`${r.id}\` | \`${r.file}\` | **${r.verdict}** | ${r.markers.join(', ')} | \`${r.baselineHash}\` -> \`${r.mutatedHash}\` -> \`${r.restoredHash}\` |`,
    ),
    '',
    `${results.length - bad.length}/${results.length} mutations killed, covering ${covered} marker assertions.`,
    '',
    'The bundle column is rule 3: the built hash had to MOVE for the mutated code to have',
    'reached the browser, and had to come back for the tree to be restored. The enforcement',
    'that a recorded kill actually ran is `e2e/global-teardown.ts`, not this file.',
    '',
  ].join('\n'),
)

console.log(
  `\n${results.length - bad.length}/${results.length} mutations killed, covering ${covered} marker assertions.`,
)
console.log('evidence written to mutations/evidence.json and mutations/EVIDENCE.md')
if (bad.length) {
  console.log('\nNot killed:')
  for (const r of bad) console.log(`  ${r.id}: ${r.verdict}`)
  console.log(
    '\nDOES NOT BUILD is a broken PATCH, not a surviving mutation: fix the patch and re-run.',
  )
  console.log('SURVIVED is evidence about the SOURCE or the test, and is the one worth stopping for.')
}
process.exit(bad.length ? 1 : 0)
