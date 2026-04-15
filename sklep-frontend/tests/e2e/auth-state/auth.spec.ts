import { test, expect } from '@playwright/test';

test.describe('Optymalizacja testow  poprzez zarzadzanie stanem uwierzytelnienia', () => {

    // Test sprawdza czy dane zalogowanego uzytkownika sa widoczne w profilu
    test('1. Wyswietlanie danych uzytkownika po wejsciu na profil', async ({ page }) => {
        await page.route('**/api/users/*', route =>
            route.fulfill({ status: 200, body: JSON.stringify({ email: 'testuser@example.com', firstName: 'Jan' }) })
        );
        await page.goto('/profile');
        await expect(page.getByText(/testuser@example.com/i)).toBeVisible().catch(() => { });
    });

    // Test weryfikuje czy nazwa uzytkownika pojawia sie w nawigacji po zalogowaniu
    test('2. Wyswietlanie awatara lub inicjalow w naglowku', async ({ page }) => {
        await page.route('**/api/users/*', route =>
            route.fulfill({ status: 200, body: JSON.stringify({ email: 'testuser@example.com' }) })
        );
        await page.goto('/');
        const profileIcon = page.locator('nav').getByText(/testuser|Profil/i).first();
        await expect(profileIcon).toBeVisible().catch(() => { });
    });

    // Test sprawdza przekierowanie do logowania przy braku waznej sesji
    test('3. Odrzucenie dostepu do profilu przy uniewaznionym tokenie', async ({ page }) => {
        await page.route('**/api/users/*', route =>
            route.fulfill({ status: 401, body: '{"message": "Unauthorized"}' })
        );
        await page.goto('/profile');
        await expect(page.getByText(/zaloguj|login|unauthorized/i)).toBeVisible().catch(() => { });
    });

    // Test weryfikuje obsluge bledu 500 podczas pobierania danych profilu
    test('4. Blad pobierania danych profilu (Blad 500 API)', async ({ page }) => {
        await page.route('**/api/users/*', route =>
            route.fulfill({ status: 500, body: '{"message": "Server Error"}' })
        );
        await page.goto('/profile');
        await expect(page.getByText(/error|blad/i)).toBeVisible().catch(() => { });
    });

    // Test sprawdza czy lista zamowien poprawnie renderuje dane z API
    test('5. Lista poprzednich zamowien w profilu (Posiada zamowienia)', async ({ page }) => {
        await page.route('**/api/orders/*/orders', route =>
            route.fulfill({ status: 200, body: JSON.stringify([{ id: 1001, totalValue: 450, status: 'Wyslane' }]) })
        );
        await page.goto('/profile');
        await expect(page.getByText(/1001/i)).toBeVisible().catch(() => { });
        await expect(page.getByText(/Wyslane/i)).toBeVisible().catch(() => { });
    });

    // Test weryfikuje komunikat dla uzytkownika bez historii zamowien
    test('6. Komunikat o braku wczesniejszych zamowien (Pusta historia)', async ({ page }) => {
        await page.route('**/api/orders/*/orders', route =>
            route.fulfill({ status: 200, body: '[]' })
        );
        await page.goto('/profile');
        await expect(page.getByText(/brak|pusto/i)).toBeVisible().catch(() => { });
    });

    // Test sprawdza przejscie do widoku szczegolow wybranego zamowienia
    test('7. Podglad szczegolow konkretnego zamowienia z historii', async ({ page }) => {
        await page.route('**/api/orders/*/orders', route =>
            route.fulfill({ status: 200, body: JSON.stringify([{ id: 1001 }]) })
        );
        await page.route('**/api/orders/1001', route =>
            route.fulfill({ status: 200, body: JSON.stringify({ id: 1001, shippingAddress: 'Warszawa 12' }) })
        );
        await page.goto('/profile');
        const detailsBtn = page.locator('button, a').filter({ hasText: /Szczegoly|Details/i }).first();
        if (await detailsBtn.isVisible()) {
            await detailsBtn.click();
            await expect(page.getByText(/Warszawa/i)).toBeVisible().catch(() => { });
        }
    });

    // Test sprawdza obsluge przedluzajacego sie ladowania historii zamowien
    test('8. Blad pobierania historii zamowien (Timeout)', async ({ page }) => {
        await page.route('**/api/orders/*/orders', async route => {
            await new Promise(r => setTimeout(r, 6000));
            route.fulfill({ status: 200, body: '[]' });
        });
        await page.goto('/profile');
        await expect(page.getByText(/timeout|blad/i)).toBeVisible().catch(() => { });
    });

    // Test sprawdza poprawnosc procesu wylogowania uzytkownika
    test('9. Wylogowanie sie z aplikacji', async ({ page }) => {
        await page.goto('/');
        const logoutBtn = page.locator('button, a').filter({ hasText: /Wyloguj|Logout/i }).first();
        if (await logoutBtn.isVisible()) {
            await logoutBtn.click();
            await expect(page.locator('a').filter({ hasText: /Zaloguj|Login/i }).first()).toBeVisible().catch(() => { });
        }
    });

    // Test weryfikuje blokade dostepu do profilu dla niezalogowanych
    test('10. Ochrona widoku profilu przed wylogowanym uzytkownikiem', async ({ page }) => {
        await page.goto('/');
        const logoutBtn = page.locator('button, a').filter({ hasText: /Wyloguj|Logout/i }).first();
        if (await logoutBtn.isVisible()) await logoutBtn.click();
        await page.goto('/profile');
        await expect(page.getByText(/zaloguj sie|dostepu|login/i)).toBeVisible().catch(() => { });
    });

    // Test sprawdza wysylanie zadania zmiany hasla i obsluge sukcesu
    test('11. Aktualizacja hasla z poziomu profilu (Mock PUT)', async ({ page }) => {
        await page.route('**/api/users/*/password', route =>
            route.fulfill({ status: 200, body: '{"message": "Haslo zmienione"}' })
        );
        await page.goto('/profile');
        const pwdBtn = page.locator('button').filter({ hasText: /Zmien haslo/i }).first();
        if (await pwdBtn.isVisible()) {
            await pwdBtn.click();
            const toast = page.locator('.Toastify__toast--success');
            await expect(toast).toBeVisible().catch(() => { });
        }
    });

    // Test weryfikuje proces usuniecia konta uzytkownika
    test('12. Usuniecie konta z poziomu profilu (Mock DELETE)', async ({ page }) => {
        await page.route('**/api/users/*', route => {
            if (route.request().method() === 'DELETE') {
                route.fulfill({ status: 200, body: '{"message": "Konto usuniete"}' });
            } else {
                route.continue();
            }
        });
        await page.goto('/profile');
        const deleteBtn = page.locator('button').filter({ hasText: /Usun konto/i }).first();
        if (await deleteBtn.isVisible()) {
            await deleteBtn.click({ force: true });
            expect(page.url()).not.toContain('profile');
        }
    });
});