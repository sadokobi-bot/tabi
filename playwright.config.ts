import { defineConfig, devices } from '@playwright/test'

const PORT = 5175

/**
 * End-to-end tests on an iPhone-sized WebKit (Safari's engine), against the app in local mode:
 * the Firebase variables are blanked, so accounts live in the test browser only and the real
 * cloud project is never touched.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'he-IL',
    timezoneId: 'Asia/Tokyo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'iPhone', use: { ...devices['iPhone 15'] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_FIREBASE_API_KEY: '',
      VITE_FIREBASE_APP_ID: '',
      VITE_GOOGLE_MAPS_API_KEY: '',
    },
  },
})
