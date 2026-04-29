import { test, expect } from '@playwright/test';
import { CartPagePOM } from '../../pom/CartPagePOM';
import { TopNavbarPOM } from '../../pom/TopNavbarPOM';

test.describe('Testy Integracyjne UI - Zarz¹dzanie stanem', () => {
    let cart: CartPagePOM;

    test.beforeEach(async ({ page }) => {
        cart = new CartPagePOM(page);
    });

    // Testy 1-3 - Patryk
    // Mockuje puste API koszyka i weryfikuje widocznoœæ nag³ówka strony.
    test('T01: Weryfikacja widocznoœci nag³ówka koszyka', async ({ page }) => {
        await page.route('**/api/users/1/cart', (route) =>
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ cartItems: [], totalValue: 0 }) }),
        );

        await cart.goto();
        await expect(cart.cartHeader).toHaveText('Koszyk');
    });

    // Sprawdza, czy po za³adowaniu pustego koszyka pojawia siê komunikat o jego pustym stanie.
    test('T02: Wyœwietlenie komunikatu dla pustego koszyka', async ({ page }) => {
        await page.route('**/api/users/1/cart', (route) =>
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ cartItems: [], totalValue: 0 }) }),
        );

        await cart.goto();
        await expect(cart.emptyCartMessage).toBeVisible();
        await expect(cart.cartItems).toHaveCount(0);
    });

    // Weryfikuje poprawne wyœwietlanie nazwy produktu na liœcie po dodaniu pojedynczego elementu.
    test('T03: Poprawne renderowanie pojedynczego produktu w koszyku', async ({ page }) => {
        await page.route('**/api/users/1/cart', (route) =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    cartItems: [
                        { productId: 101, name: 'P1', price: 10, quantity: 1, totalPrice: 10, imageUrl: '/img.jpg' },
                    ],
                    totalValue: 10,
                }),
            }),
        );

        await cart.goto();
        await expect(cart.cartItems).toHaveCount(1);
        await expect(cart.cartItems.nth(0).locator('.item-name')).toHaveText('P1');
    });





    // Testy 4-6 - Martyna
    // Sprawdza, czy aplikacja poprawnie renderuje liczbê produktów zgodn¹ z danymi API.
    test('T04: Poprawna liczba elementów dla wielu produktów', async ({ page }) => {
        await page.route('**/api/users/1/cart', (route) =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    cartItems: [
                        { productId: 101, name: 'P1', price: 10, quantity: 1, totalPrice: 10, imageUrl: '/1.jpg' },
                        { productId: 102, name: 'P2', price: 20, quantity: 2, totalPrice: 40, imageUrl: '/2.jpg' },
                    ],
                    totalValue: 50,
                }),
            }),
        );

        await cart.goto();
        await expect(cart.cartItems).toHaveCount(2);
    });

    // Testuje czy po zmianie iloœci produktu wyzwalane jest powiadomienie o sukcesie (Toast).
    test('T05: Wyœwietlenie powiadomienia po zmianie iloœci produktu', async ({ page }) => {
        await page.route('**/api/users/1/cart', (route) =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    cartItems: [{ productId: 101, name: 'P1', price: 10, quantity: 1, totalPrice: 10, imageUrl: '/1.jpg' }],
                    totalValue: 10,
                }),
            }),
        );

        await page.route('**/api/users/1/cart/101', (route) => {
            if (route.request().method() === 'PUT') {
                return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
            }
            return route.continue();
        });

        await cart.goto();
        await cart.changeQuantity(0, 2);

        await expect(page.locator('.Toastify__toast--success')).toBeVisible({ timeout: 5000 });
    });

    // Weryfikuje zabezpieczenie przed ustawieniem iloœci produktu na 0 w koszyku.
    test('T06: Walidacja minimalnej iloœci produktu w koszyku', async ({ page }) => {
        await page.route('**/api/users/1/cart', (route) =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    cartItems: [{ productId: 101, name: 'P1', price: 10, quantity: 1, totalPrice: 10, imageUrl: '/1.jpg' }],
                    totalValue: 10,
                }),
            }),
        );

        await cart.goto();
        await expect(cart.quantityInputs.nth(0)).toHaveValue('1');

        await cart.changeQuantity(0, 0);
        await expect(cart.quantityInputs.nth(0)).toHaveValue('1');
    });





    // Testy 7-9 - £ukasz
    // Sprawdza, czy usuniêcie produktu z koszyka skutkuje wyœwietleniem powiadomienia.
    test('T07: Wyœwietlenie powiadomienia po usuniêciu produktu', async ({ page }) => {
        await page.route('**/api/users/1/cart', (route) =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    cartItems: [{ productId: 101, name: 'P1', price: 10, quantity: 1, totalPrice: 10, imageUrl: '/1.jpg' }],
                    totalValue: 10,
                }),
            }),
        );

        await page.route('**/api/users/1/cart/101', (route) => {
            if (route.request().method() === 'DELETE') return route.fulfill({ status: 200, body: '{}' });
            return route.continue();
        });

        await cart.goto();
        await cart.removeItem(0);
        await expect(page.locator('.Toastify__toast--success')).toBeVisible({ timeout: 5000 });
    });

    // Weryfikuje poprawne formatowanie wartoœci sumarycznej koszyka.
    test('T08: Weryfikacja formatowania sumy zamówienia', async ({ page }) => {
        await page.route('**/api/users/1/cart', (route) =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    cartItems: [{ productId: 101, name: 'P1', price: 10, quantity: 1, totalPrice: 10, imageUrl: '/1.jpg' }],
                    totalValue: 10,
                }),
            }),
        );

        await cart.goto();
        await expect(cart.totalValue).toContainText('10.00');
    });

    // Symuluje pe³en proces sk³adania zamówienia i weryfikuje czy koszyk jest czyszczony po sukcesie.
    test('T09: Skuteczne z³o¿enie zamówienia i wyczyszczenie koszyka', async ({ page }) => {
        let isOrdered = false;

        await page.route('**/api/users/*/cart', (route) => {
            if (route.request().method() !== 'GET') return route.continue();

            const body = !isOrdered
                ? {
                    cartItems: [
                        { productId: 101, name: 'P1', price: 10, quantity: 1, totalPrice: 10, imageUrl: '/1.jpg' },
                    ],
                    totalValue: 10,
                }
                : { cartItems: [], totalValue: 0 };

            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(body),
            });
        });

        await page.route('**/api/orders/*/placeorder', (route) => {
            if (route.request().method() === 'POST') {
                isOrdered = true;
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ orderId: 999, message: 'OK' }),
                });
            }
            return route.continue();
        });

        await cart.goto();
        await expect(cart.checkoutButton).toBeVisible();
        await expect(cart.checkoutButton).toBeEnabled();

        await cart.placeOrder();

        await expect(page.locator('.Toastify__toast--success')).toBeVisible({ timeout: 5000 });
        await expect(cart.emptyCartMessage).toBeVisible({ timeout: 5000 });
    });




    // Testy 10-12 - Pawe³
    // Weryfikuje obs³ugê b³êdu przy próbie sk³adania zamówienia.
    test('T10: Obs³uga b³êdu serwera podczas sk³adania zamówienia', async ({ page }) => {
        await page.route('**/api/users/1/cart', (route) =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    cartItems: [{ productId: 101, name: 'P1', price: 10, quantity: 1, totalPrice: 10, imageUrl: '/1.jpg' }],
                    totalValue: 10,
                }),
            }),
        );

        await page.route('**/api/orders/1/placeorder', (route) =>
            route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Insufficient stock' }) }),
        );

        await cart.goto();
        await cart.placeOrder();
        await expect(page.locator('.Toastify__toast--error')).toBeVisible({ timeout: 5000 });
    });

    // Sprawdza czy stan koszyka utrzymuje siê po odœwie¿eniu strony.
    test('T11: Zachowanie stanu koszyka po prze³adowaniu strony', async ({ page }) => {
        await page.route('**/api/users/1/cart', (route) =>
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ cartItems: [], totalValue: 0 }) }),
        );

        await cart.goto();
        await page.reload();
        await expect(cart.cartHeader).toHaveText('Koszyk');
    });

    // Weryfikuje proces wylogowania u¿ytkownika w pasku nawigacji.
    test('T12: Poprawne wylogowanie u¿ytkownika z poziomu nawigacji', async ({ page }) => {
        const nav = new TopNavbarPOM(page);

        await nav.gotoHome();
        await nav.logout();

        await expect(nav.loginLink).toBeVisible();
    });
});