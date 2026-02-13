import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  retries: 1,
  workers: 1,
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'electron',
      use: {
        // We don't use standard browser launch options for Electron
      },
    },
  ],
});
