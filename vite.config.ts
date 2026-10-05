import { configDefaults, defineConfig } from 'vitest/config'

// base must match the GitHub Pages project subpath:
// https://systemslibrarian.github.io/crypto-lab-agreeing-in-public/
export default defineConfig({
  base: '/crypto-lab-agreeing-in-public/',
  test: {
    // Colocated unit tests only. The Playwright specs in e2e/ must not be
    // collected by Vitest, which would run them with no browser.
    include: ['src/**/*.test.ts'],
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
