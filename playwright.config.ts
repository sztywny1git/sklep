import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/api',
    use: {
        baseURL: 'http://localhost:5000',
        extraHTTPHeaders: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
    },
});