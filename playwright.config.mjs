import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/site',
  fullyParallel: true,
  webServer: { command: 'npx http-server site -p 4173 -c-1', port: 4173, reuseExistingServer: true },
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
