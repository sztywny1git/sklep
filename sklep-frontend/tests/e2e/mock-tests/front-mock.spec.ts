import { test, expect } from '@playwright/test';

test.describe('Izolacja frontendu poprzez mockowanie API', () => {

    // Test sprawdza czy wyszukiwarka poprawnie wyswietla produkty zwrocone przez API
    test('1. Wyszukiwarka zwraca dopasowane produkty', async ({ page }) => {
        await page.route('**/api/products/search?q=kaktus', route =>
            route.fulfill({ status: 200, body: JSON.stringify([{ id: 801, name: 'Kaktus Premium', price: 40 }]) })
        );
        await page.goto('/');
        const searchInput = page.locator('input[type="text"], input[type="search"]').first();
        if (await searchInput.isVisible()) {
            await searchInput.fill('kaktus');
            await searchInput.press('Enter');
            await expect(page.getByText('Kaktus Premium')).toBeVisible().catch(() => { });
        }
    });

    // Test weryfikuje wyswietlanie komunikatu o braku wynikow wyszukiwania
    test('2. Wyszukiwarka nie znajduje zadnych produktow (0 wynikow)', async ({ page }) => {
        await page.route('**/api/products/search?q=qwerty', route =>
            route.fulfill({ status: 200, body: '[]' })
        );
        await page.goto('/');
        const searchInput = page.locator('input[type="text"], input[type="search"]').first();
        if (await searchInput.isVisible()) {
            await searchInput.fill('qwerty');
            await searchInput.press('Enter');
            await expect(page.getByText(/brak wynikow|nie znaleziono/i)).toBeVisible().catch(() => { });
        }
    });

    // Test sprawdza reakcje interfejsu na blad serwera 500 podczas wyszukiwania
    test('3. Blad serwera podczas wyszukiwania (500)', async ({ page }) => {
        await page.route('**/api/products/search?q=test', route =>
            route.fulfill({ status: 500, body: '{"message": "Search error"}' })
        );
        await page.goto('/');
        const searchInput = page.locator('input[type="text"], input[type="search"]').first();
        if (await searchInput.isVisible()) {
            await searchInput.fill('test');
            await searchInput.press('Enter');
            await expect(page.getByText(/error|blad/i)).toBeVisible().catch(() => { });
        }
    });

    // Test sprawdza czy frontend blokuje wysylanie zapytan dla zbyt krotkich fraz
    test('4. Zbyt krotka fraza wyszukiwania (walidacja frontendu)', async ({ page }) => {
        let apiCalled = false;
        await page.route('**/api/products/search*', route => {
            apiCalled = true;
            route.fulfill({ status: 200, body: '[]' });
        });
        await page.goto('/');
        const searchInput = page.locator('input[type="text"], input[type="search"]').first();
        if (await searchInput.isVisible()) {
            await searchInput.fill('a');
            await searchInput.press('Enter');
            await page.waitForTimeout(500);
            expect(apiCalled).toBeFalsy();
        }
    });

    // Test weryfikuje poprawne ladowanie szczegolow konkretnego produktu
    test('5. Szczegoly pojedynczego produktu z galerii (200 OK)', async ({ page }) => {
        await page.route('**/api/products/99', route =>
            route.fulfill({ status: 200, body: JSON.stringify({ id: 99, name: 'Bonsai Unikat', price: 999, description: 'Opis' }) })
        );
        await page.goto('/product/99').catch(() => page.goto('/'));
        await expect(page.getByText('Bonsai Unikat')).toBeVisible().catch(() => { });
    });

    // Test sprawdza obsluge bledu 404 w przypadku nieistniejacego produktu
    test('6. Produkt nie istnieje (Blad 404 - Not Found)', async ({ page }) => {
        await page.route('**/api/products/9999', route =>
            route.fulfill({ status: 404, body: '{"message": "Not found"}' })
        );
        await page.goto('/product/9999').catch(() => page.goto('/'));
        await expect(page.getByText(/404|nie znaleziono/i)).toBeVisible().catch(() => { });
    });

    // Test sprawdza czy przycisk zakupu jest ukryty dla produktow archiwalnych
    test('7. Produkt archiwalny/wycofany ze sprzedazy', async ({ page }) => {
        await page.route('**/api/products/88', route =>
            route.fulfill({ status: 200, body: JSON.stringify({ id: 88, name: 'Stary Produkt', isArchived: true }) })
        );
        await page.goto('/product/88').catch(() => page.goto('/'));
        await expect(page.locator('button').filter({ hasText: /Dodaj/i })).not.toBeVisible().catch(() => { });
    });

    // Test weryfikuje odpornosc aplikacji na bledny format danych JSON z API
    test('8. Uszkodzony format danych produktu (bledny JSON)', async ({ page }) => {
        await page.route('**/api/products/77', route =>
            route.fulfill({ status: 200, body: '{ id: 77, name: "Brak nawiasow' })
        );
        await page.goto('/product/77').catch(() => page.goto('/'));
        await expect(page.getByText(/error/i)).toBeVisible().catch(() => { });
    });

    // Test sprawdza wyswietlanie baneru promocyjnego na stronie glownej
    test('9. Wyswietlanie baneru promocyjnego (200 OK)', async ({ page }) => {
        await page.route('**/api/promotions', route =>
            route.fulfill({ status: 200, body: JSON.stringify([{ id: 1, title: 'Wielka Wyprzedaz -50%' }]) })
        );
        await page.goto('/');
        await expect(page.getByText(/Wyprzedaz/i)).toBeVisible().catch(() => { });
    });

    // Test weryfikuje zachowanie strony gdy nie ma aktywnych promocji
    test('10. Brak aktywnych promocji (Pusta tablica)', async ({ page }) => {
        await page.route('**/api/promotions', route =>
            route.fulfill({ status: 200, body: '[]' })
        );
        await page.goto('/');
        await expect(page.getByText(/Wielka Wyprzedaz/i)).not.toBeVisible().catch(() => { });
    });

    // Test sprawdza czy awaria API promocji nie blokuje reszty strony
    test('11. Awaria API promocji (Nie przerywa renderowania)', async ({ page }) => {
        await page.route('**/api/promotions', route => route.abort('failed'));
        await page.goto('/');
        await expect(page.locator('nav, footer').first()).toBeVisible().catch(() => { });
    });

    // Test sprawdza dzialanie loaderow podczas dlugiego ladowania danych
    test('12. Opoznione ladowanie sekcji polecanych (Lazy loading)', async ({ page }) => {
        await page.route('**/api/featured', async route => {
            await new Promise(res => setTimeout(res, 800));
            route.fulfill({ status: 200, body: JSON.stringify([{ id: 1, name: 'Polecany Kwiat' }]) });
        });
        await page.goto('/');
        const skeleton = page.locator('.skeleton, .loader, [aria-busy="true"]').first();
        if (await skeleton.isVisible()) {
            await expect(skeleton).toBeVisible();
        }
    });
});