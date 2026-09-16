import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://127.0.0.1:4173', ...devices['Desktop Chrome'] },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    ...(process.env.TEST_EDGE === '1' ? [{ name: 'edge', use: { ...devices['Desktop Chrome'], channel: 'msedge' as const } }] : []),
  ],
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI },
})
