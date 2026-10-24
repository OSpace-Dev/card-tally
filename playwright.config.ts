import { defineConfig } from '@playwright/test'
import { randomBytes } from 'node:crypto'
// Shared only by this test run and its child processes; never a real ledger key.
process.env.LEDGER_TEST_ACCESS_KEY ||= randomBytes(24).toString('base64url')
export default defineConfig({
  testDir: './tests/browser', fullyParallel: false, workers: 1,
  use: { baseURL: 'http://127.0.0.1:3099', browserName: 'chromium', ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}), trace: 'retain-on-failure' },
  webServer: { command: 'node tests/browser-server.js', url: 'http://127.0.0.1:3099', reuseExistingServer: false, timeout: 20000 },
})
