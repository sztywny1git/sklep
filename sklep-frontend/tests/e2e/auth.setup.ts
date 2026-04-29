import { test as setup } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
    const authDir = path.dirname(authFile);
    if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
    }

    await page.goto('/');

    await page.evaluate(() => {
        localStorage.setItem('user', JSON.stringify({
            id: 1,
            name: 'testuser@example.com',
            isLoggedIn: true,
            token: 'mock-jwt-token'
        }));
    });

    await page.context().storageState({ path: authFile });
});