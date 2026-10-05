import { defineConfig } from '@playwright/test'

// Port 4731 is this lab's own, pinned in the catalog's
// tools/playwright-ports.json. Never the Vite default 4173: a shared port means
// `reuseExistingServer` can silently scan a DIFFERENT lab's preview, or -- during
// a §4.1c mutation check -- an unmutated checkout still serving from an earlier
// run, which reads as "the mutation was not caught".
const baseURL = 'http://localhost:4731/crypto-lab-agreeing-in-public/'

export default defineConfig({
  testDir: './e2e',
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  // global-setup mints this run's id and empties the observation sink;
  // global-teardown reads it back and fails the run when a kill recorded in
  // e2e/verdict-mutations.json never actually executed. The teardown runs
  // whatever the tests did, which a project with `dependencies:` would not --
  // a dependent project is SKIPPED when its dependency fails, and a run with a
  // mutation applied is exactly where that answer matters most.
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  // Not the default `test-results`: Playwright wipes outputDir when a run
  // starts, which would race the sink truncation above. The sink lives beside
  // it at test-results/verdict-observations.ndjson.
  outputDir: 'test-results/artifacts',
  use: {
    baseURL,
    colorScheme: 'dark',
    trace: 'retain-on-failure',
  },
  webServer: {
    // Build before serving. `vite preview` serves whatever is already in dist/,
    // so without the build in front a failing build leaves the previous good
    // bundle in place and the whole suite passes green against source that no
    // longer compiles -- which silently invalidates mutation checking.
    command: 'npm run build && npm run preview -- --port 4731 --strictPort',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
