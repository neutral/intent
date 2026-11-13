// Browser checks for the Editor and the Portal: real Chromium, headless, against the
// built assets (run `npm run build` first). Results go to the ignored tmp/ directory.
// Set INTENT_CHROMIUM to a Chromium executable to use one other than Playwright's own.
import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const output = process.env.INTENT_BROWSER_OUTPUT ?? fileURLToPath(new URL('../../tmp/browser/', import.meta.url));

export default defineConfig({
  testDir: fileURLToPath(new URL('.', import.meta.url)),
  testMatch: '*.browser.spec.mjs',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 8_000 },
  outputDir: `${output}/results`,
  reporter: [['list']],
  use: {
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
    launchOptions: process.env.INTENT_CHROMIUM ? { executablePath: process.env.INTENT_CHROMIUM } : {},
  },
});
