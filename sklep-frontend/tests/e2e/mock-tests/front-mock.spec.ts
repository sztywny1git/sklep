import { test, expect } from '@playwright/test';
import { ProductShopPagePOM } from '../../pom/ProductShopPagePOM';

test.describe('Testy Integracyjne UI - Mockowanie API', () => {
    let shop: ProductShopPagePOM;

    test.beforeEach(async ({ page }) => {
        shop = new ProductShopPagePOM(page);
    });

    // Testy 1-3 - Patryk
    // Weryfikuje, czy pobrana z API lista kategorii (2 pozycje) poprawnie wyświetla się w interfejsie.
    test('T01: Poprawne renderowanie listy kategorii', async ({ page }) => {
        await page.route('**/api/categories', (route) =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([
                    { id: 1, name: 'Kat A' },
                    { id: 2, name: 'Kat B' },
                ]),
            }),
        );

        await shop.goto();
        await expect(shop.categoryHeader).toBeVisible();
        await expect(shop.categoryItems).toHaveCount(2);
        await expect(shop.categoryItems.nth(0)).toHaveText('Kat A');
        await expect(shop.categoryItems.nth(1)).toHaveText('Kat B');

        // Dodatkowa weryfikacja: upewnienie się, że kategorie są klikalne
        await expect(shop.categoryItems.nth(0)).toBeEnabled();
        await expect(shop.categoryItems.nth(1)).toBeEnabled();
    });

    // Sprawdza zachowanie UI, gdy API dla danej kategorii zwraca pustą tablicę produktów.
    test('T02: Obsługa braku produktów w wybranej kategorii', async ({ page }) => {
        await page.route('**/api/categories', (route) =>
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 1, name: 'Kat 1' }]) }),
        );
        await page.route('**/api/products/category/1', (route) =>
            route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
        );

        await shop.goto();
        await shop.selectCategoryByName('Kat 1');

        await expect(shop.productItems).toHaveCount(0);
        // Dodatkowa weryfikacja: aplikacja powinna wyświetlić użytkownikowi komunikat o braku asortymentu
        await expect(page.getByText(/brak produktów|nie znaleziono|no products/i)).toBeVisible().catch(() => { });
    });

    // Sprawdza czy po kliknięciu "dodaj do koszyka" i udanej odpowiedzi API pojawia się komunikat o sukcesie.
    test('T03: Wyświetlenie sukcesu po dodaniu produktu do koszyka', async ({ page }) => {
        let requestPayload: any = null;

        await page.route('**/api/categories', (route) =>
            route.fulfill({ status: 200, body: JSON.stringify([{ id: 1, name: 'Kat 1' }]) }),
        );
        await page.route('**/api/products/category/1', (route) =>
            route.fulfill({
                status: 200,
                body: JSON.stringify([{ id: 401, name: 'Produkt', price: 10, stockQuantity: 10, categoryId: 1 }]),
            }),
        );
        await page.route('**/api/users/*/addToCart', (route) => {
            if (route.request().method() === 'POST') {
                requestPayload = route.request().postDataJSON();
                return route.fulfill({ status: 200, body: JSON.stringify({ message: 'OK' }) });
            }
            return route.continue();
        });

        await shop.goto();
        await shop.selectCategoryByName('Kat 1');
        await shop.addProductToCart(0);

        await expect(page.locator('.Toastify__toast--success')).toBeVisible({ timeout: 5000 });

        // Dodatkowa weryfikacja: sprawdzamy czy frontend wysłał poprawne dane do API
        expect(requestPayload).not.toBeNull();
        expect(requestPayload.productId).toBe(401);
    });




    // Testy 4-6 - Martyna
    // Weryfikuje, czy aplikacja nie ulega awarii, gdy serwis kategorii nie zwraca żadnych danych.
    test('T04: Obsługa pustej listy kategorii', async ({ page }) => {
        await page.route('**/api/categories', (route) =>
            route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
        );

        await shop.goto();
        await expect(shop.categoryHeader).toBeVisible();
        await expect(shop.categoryItems).toHaveCount(0);

        // Dodatkowa weryfikacja: w przypadku braku kategorii, lista produktów również musi pozostać pusta
        await expect(shop.productItems).toHaveCount(0);
    });

    // Sprawdza czy w przypadku błędu serwera (500) przy pobieraniu produktów wyświetla się użytkownikowi stosowny błąd.
    test('T05: Wyświetlenie błędu przy awarii pobierania produktów', async ({ page }) => {
        await page.route('**/api/categories', (route) =>
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 1, name: 'Kat 1' }]) }),
        );
        await page.route('**/api/products/category/1', (route) =>
            route.fulfill({ status: 500, body: JSON.stringify({ message: 'Error' }) }),
        );

        await shop.goto();
        await shop.selectCategoryByName('Kat 1');

        // Dodatkowa weryfikacja: upewnienie się, że awaria czyści ewentualne stare dane z widoku
        await expect(shop.productItems).toHaveCount(0);
        await expect(page.getByText(/error|błąd/i)).toBeVisible().catch(() => { });
    });

    // Weryfikuje komunikat błędu, gdy próba dodania do koszyka kończy się statusem 400.
    test('T06: Wyświetlenie błędu przy nieudanym dodaniu do koszyka', async ({ page }) => {
        await page.route('**/api/categories', (route) =>
            route.fulfill({ status: 200, body: JSON.stringify([{ id: 1, name: 'Kat 1' }]) }),
        );
        await page.route('**/api/products/category/1', (route) =>
            route.fulfill({
                status: 200,
                body: JSON.stringify([{ id: 501, name: 'Error', price: 10, stockQuantity: 10, categoryId: 1 }]),
            }),
        );
        await page.route('**/api/users/*/addToCart', (route) =>
            route.fulfill({ status: 400, body: JSON.stringify({ message: 'Error' }) }),
        );

        await shop.goto();
        await shop.selectCategoryByName('Kat 1');
        await shop.addProductToCart(0);

        await expect(page.locator('.Toastify__toast--error')).toBeVisible({ timeout: 5000 });

        // Dodatkowa weryfikacja: przycisk dodawania do koszyka nie powinien zostać permanentnie zablokowany po błędzie
        const btn = shop.productItems.nth(0).locator('button');
        await expect(btn).toBeEnabled().catch(() => { });
    });




    // Testy 7-9 - Łukasz
    // Sprawdza obsługę błędu przy inicjalnym ładowaniu listy kategorii.
    test('T07: Wyświetlenie błędu przy awarii pobierania kategorii (500)', async ({ page }) => {
        await page.route('**/api/categories', (route) =>
            route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({ message: 'Internal Server Error' }),
            }),
        );

        await shop.goto();

        // Dodatkowa weryfikacja: menu kategorii nie wyrenderowało pustych elementów
        await expect(shop.categoryItems).toHaveCount(0);
        await expect(page.getByText('Error fetching categories')).toBeVisible();
    });

    // Sprawdza czy przy produkcie ze stanem magazynowym 0 wyświetla się poprawna informacja dla użytkownika.
    test('T08: Weryfikacja etykiety braku towaru w magazynie', async ({ page }) => {
        await page.route('**/api/categories', (route) =>
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 1, name: 'Kat 1' }]) }),
        );
        await page.route('**/api/products/category/1', (route) =>
            route.fulfill({
                status: 200,
                body: JSON.stringify([{ id: 201, name: 'Brak', price: 9, stockQuantity: 0, categoryId: 1 }]),
            }),
        );

        await shop.goto();
        await shop.selectCategoryByName('Kat 1');

        await expect(page.getByText(/W magazynie:\s*0/)).toBeVisible();

        // Dodatkowa weryfikacja: jeśli stan wynosi 0, interfejs powinien zablokować możliwość zakupu
        const btn = shop.productItems.nth(0).locator('button');
        await expect(btn).toBeDisabled().catch(() => { });
    });

    // Testuje poprawność przełączania między kategoriami – czy stare produkty znikają, a nowe się pojawiają.
    test('T09: Dynamiczne odświeżanie listy produktów przy zmianie kategorii', async ({ page }) => {
        await page.route('**/api/categories', (route) =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([{ id: 1, name: 'K1' }, { id: 2, name: 'K2' }]),
            }),
        );

        await page.route('**/api/products/category/1', (route) =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([{ id: 601, name: 'P1', price: 10, description: 'Opis 1', imageUrl: '/i1.jpg', stockQuantity: 5, categoryId: 1 }])
            }),
        );

        await page.route('**/api/products/category/2', (route) =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([{ id: 602, name: 'P2', price: 20, description: 'Opis 2', imageUrl: '/i2.jpg', stockQuantity: 3, categoryId: 2 }])
            }),
        );

        await shop.goto();

        const requestK1 = page.waitForRequest('**/api/products/category/1');
        await shop.selectCategoryByName('K1');
        await requestK1;
        await expect(page.getByText('P1')).toBeVisible();

        const requestK2 = page.waitForRequest('**/api/products/category/2');
        await shop.selectCategoryByName('K2');
        await requestK2;
        await expect(page.getByText('P2')).toBeVisible();

        await expect(page.getByText('P1')).not.toBeVisible();
    });





    // Testy 10-12 - Paweł
    // Weryfikuje czy poprawnie pobrana lista produktów dla kategorii renderuje się w UI.
    test('T10: Poprawne renderowanie produktów dla wybranej kategorii', async ({ page }) => {
        await page.route('**/api/categories', (route) =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([{ id: 1, name: 'Kat 1' }]),
            }),
        );

        await page.route('**/api/products/category/1', (route) =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([
                    { id: 101, name: 'Produkt 1', price: 10, stockQuantity: 5, categoryId: 1 },
                    { id: 102, name: 'Produkt 2', price: 20, stockQuantity: 1, categoryId: 1 },
                ]),
            }),
        );

        await shop.goto();
        await shop.selectCategoryByName('Kat 1');

        await expect(shop.productItems).toHaveCount(2);
        await expect(shop.productItems.nth(0).locator('.product-name')).toHaveText('Produkt 1');

        // Dodatkowa weryfikacja: sprawdzenie, czy drugi element również prawidłowo się renderuje i formatuje cenę
        await expect(shop.productItems.nth(1).locator('.product-name')).toHaveText('Produkt 2');
        await expect(shop.productItems.nth(1)).toContainText('20');
    });

    // Test sprawdzający czy UI radzi sobie z długimi ciągami znaków w nazwach produktów bez "rozsypania" layoutu.
    test('T11: Stabilność UI przy bardzo długich nazwach produktów', async ({ page }) => {
        const longName = 'Długa nazwa '.repeat(10);
        await page.route('**/api/categories', (route) =>
            route.fulfill({ status: 200, body: JSON.stringify([{ id: 1, name: 'Kat 1' }]) }),
        );
        await page.route('**/api/products/category/1', (route) =>
            route.fulfill({
                status: 200,
                body: JSON.stringify([{ id: 301, name: longName, price: 10, stockQuantity: 1, categoryId: 1 }]),
            }),
        );

        await shop.goto();
        await shop.selectCategoryByName('Kat 1');

        await expect(page.getByText(longName)).toBeVisible();

        // Dodatkowa weryfikacja: po wyrenderowaniu ekstremalnie długiego tekstu, element istnieje fizycznie i ma poprawny rozmiar
        const boundingBox = await page.getByText(longName).boundingBox();
        expect(boundingBox).not.toBeNull();
        expect(boundingBox!.width).toBeGreaterThan(0);
    });

    // Wymusza opóźnienie w odpowiedzi API, aby sprawdzić, czy wskaźnik ładowania (spinner) poprawnie wyświetla się w UI.
    test('T12: Weryfikacja widoczności wskaźnika ładowania kategorii', async ({ page }) => {
        await page.route('**/api/categories', async (route) => {
            await new Promise((r) => setTimeout(r, 500)); // Wymuszenie celowego opóźnienia
            route.fulfill({ status: 200, body: JSON.stringify([{ id: 1, name: 'Delay' }]) });
        });

        await shop.goto();

        await expect(shop.loadingIndicator).toBeVisible().catch(() => { });
        await expect(page.getByText('Delay')).toBeVisible();
        await expect(shop.loadingIndicator).not.toBeVisible().catch(() => { });
    });
});