import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    // Global settings
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 1,
    workers: 1,
    reporter: 'html',
    timeout: 30_000,

    projects: [
        /* =======================================
           BACKEND API TESTS
        ======================================= */
        {
            name: 'api',
            testDir: './tests/api',
            use: {
                baseURL: 'http://localhost:5000',
                extraHTTPHeaders: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
            },
        },

        /* =======================================
           FRONTEND E2E TESTS
        ======================================= */
        {
            name: 'setup',
            testDir: './sklep-frontend/tests/e2e',
            testMatch: /.*\.setup\.ts/,
            use: {
                baseURL: 'http://localhost:3000',
            }
        },
        {
            name: 'auth-state-tests',
            testDir: './sklep-frontend/tests/e2e/auth-state',
            dependencies: ['setup'],
            use: {
                ...devices['Desktop Chrome'],
                baseURL: 'http://localhost:3000',
                storageState: 'playwright/.auth/user.json',
                trace: 'on-first-retry',
                screenshot: 'only-on-failure',
                actionTimeout: 10_000,
            },
        },
        {
            name: 'mocking-tests',
            testDir: './sklep-frontend/tests/e2e/mock-tests',
            use: {
                ...devices['Desktop Chrome'],
                baseURL: 'http://localhost:3000',
                trace: 'on-first-retry',
                screenshot: 'only-on-failure',
                actionTimeout: 10_000,
            },
        }
    ],
});