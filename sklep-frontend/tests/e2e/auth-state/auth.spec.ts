import { test, expect } from '@playwright/test';
import { CartPagePOM } from '../../pom/CartPagePOM';
import { TopNavbarPOM } from '../../pom/TopNavbarPOM';

test.describe('Testy Integracyjne UI - Zarzadzanie stanem', () => {
    let cart: CartPagePOM;

    test.beforeEach(async ({ page }) => {
        cart = new CartPagePOM(page);
    });

    // Testy 1-3 - Patryk
    // Mockuje puste API koszyka i weryfikuje widocznosc naglowka strony.
    test('T01: Weryfikacja widocznosci naglowka koszyka', async ({ page }) => {
        await page.route('**/api/users/1/cart', (route) =>
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ cartItems: [], totalValue: 0 }) }),
        );

        await cart.goto();
        await expect(page).toHaveURL(/.*cart/);
        await expect(cart.cartHeader).toHaveText('Koszyk');

        if (await cart.checkoutButton.isVisible()) {
            await expect(cart.checkoutButton).toBeDisabled();
        }
        await expect(page.locator('.cart-item-container, .item-row')).toHaveCount(0);
    });

    // Sprawdza, czy po zaladowaniu pustego koszyka pojawia sie komunikat o jego pustym stanie.
    test('T02: Wyswietlenie komunikatu dla pustego koszyka', async ({ page }) => {
        await page.route('**/api/users/1/cart', (route) =>
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ cartItems: [], totalValue: 0 }) }),
        );

        await cart.goto();
        await expect(cart.emptyCartMessage).toBeVisible();
        await expect(cart.cartItems).toHaveCount(0);
        await expect(cart.totalValue).toBeHidden().catch(() => expect(cart.totalValue).toContainText('0'));

        if (await cart.checkoutButton.isVisible()) {
            await expect(cart.checkoutButton).toBeDisabled();
        }
    });

    // Testuje czy po zmianie ilosci produktu wyzwalane jest powiadomienie o sukcesie (Toast).
    test('T03: Wyswietlenie powiadomienia po zmianie ilosci produktu', async ({ page }) => {
        let updatePayload: any = null;

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
                updatePayload = route.request().postDataJSON();
                return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
            }
            return route.continue();
        });

        await cart.goto();

        const responsePromise1 = page.waitForResponse(res => res.url().includes('/api/users/1/cart/101') && res.request().method() === 'PUT');
        await cart.changeQuantity(0, 2);
        await responsePromise1;

        await expect(page.locator('.Toastify__toast--success').first()).toBeVisible({ timeout: 5000 });
        expect(updatePayload).not.toBeNull();
        expect(updatePayload).toBe(2);

        const responsePromise2 = page.waitForResponse(res => res.url().includes('/api/users/1/cart/101') && res.request().method() === 'PUT');
        await cart.changeQuantity(0, 5);
        await responsePromise2;

        expect(updatePayload).toBe(5);
    });





    // Testy 4-6 - Martyna
    // Sprawdza, czy aplikacja poprawnie renderuje liczbe produktow zgodna z danymi API.
    test('T04: Poprawna liczba elementow dla wielu produktow', async ({ page }) => {
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
        await expect(cart.cartItems.nth(0).locator('.item-name')).toHaveText('P1');
        await expect(cart.cartItems.nth(1).locator('.item-name')).toHaveText('P2');
        await expect(cart.quantityInputs.nth(1)).toHaveValue('2');
        await expect(cart.totalValue).toContainText('50');
        await expect(cart.checkoutButton).toBeEnabled();
    });

    // Weryfikuje poprawne wyswietlanie nazwy produktu na liscie po dodaniu pojedynczego elementu.
    test('T05: Poprawne renderowanie pojedynczego produktu w koszyku', async ({ page }) => {
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

        const item = cart.cartItems.nth(0);
        await expect(item.locator('.item-name')).toHaveText('P1');
        await expect(cart.quantityInputs.nth(0)).toHaveValue('1');
        await expect(item).toContainText('10');

        const image = item.locator('img');
        await expect(image).toBeVisible();
        await expect(image).toHaveAttribute('src', '/img.jpg');
    });


    // Weryfikuje zabezpieczenie przed ustawieniem ilosci produktu na 0 w koszyku.
    test('T06: Walidacja minimalnej ilosci produktu w koszyku', async ({ page }) => {
        let apiCalled = false;

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
            apiCalled = true;
            return route.continue();
        });

        await cart.goto();
        const input = cart.quantityInputs.nth(0);
        await expect(input).toHaveAttribute('min', '1');
        await expect(input).toHaveValue('1');

        await cart.changeQuantity(0, 0);
        await expect(input).toHaveValue('1');

        expect(apiCalled).toBeFalsy();
    });





    // Testy 7-9 - Lukasz
    // Sprawdza, czy usuniecie produktu z koszyka skutkuje wyswietleniem powiadomienia.
    test('T07: Wyswietlenie powiadomienia po usunieciu produktu', async ({ page }) => {
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
        await expect(cart.cartItems).toHaveCount(1);

        await cart.removeItem(0);
        await expect(page.locator('.Toastify__toast--success')).toBeVisible({ timeout: 5000 });

        await expect(cart.cartItems).toHaveCount(0);
        await expect(cart.emptyCartMessage).toBeVisible();
    });

    // Weryfikuje poprawne formatowanie wartosci sumarycznej koszyka.
    test('T08: Weryfikacja formatowania sumy zamowienia', async ({ page }) => {
        await page.route('**/api/users/1/cart', (route) =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    cartItems: [{ productId: 101, name: 'P1', price: 10.99, quantity: 2, totalPrice: 21.98, imageUrl: '/1.jpg' }],
                    totalValue: 21.98,
                }),
            }),
        );

        await cart.goto();
        await expect(cart.totalValue).toContainText('21.98');
        await expect(cart.totalValue).toBeVisible();
    });

    // Symuluje pelen proces skladania zamowienia i weryfikuje czy koszyk jest czyszczony po sukcesie.
    test('T09: Skuteczne zlozenie zamowienia i wyczyszczenie koszyka', async ({ page }) => {
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

        await page.route('**/api/orders/*/placeorder', async (route) => {
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
        await expect(cart.cartItems).toHaveCount(0);
    });




    // Testy 10-12 - Pawel
    // Weryfikuje obsluge bledu przy probie skladania zamowienia.
    test('T10: Obsluga bledu serwera podczas skladania zamowienia', async ({ page }) => {
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
        await expect(cart.checkoutButton).toBeEnabled();

        await cart.placeOrder();
        await expect(page.locator('.Toastify__toast--error')).toBeVisible({ timeout: 5000 });

        await expect(cart.cartItems).toHaveCount(1);
        await expect(cart.checkoutButton).toBeEnabled();
    });

    // Sprawdza czy stan koszyka utrzymuje sie po odswiezeniu strony.
    test('T11: Zachowanie stanu koszyka po przeladowaniu strony', async ({ page }) => {
        let getCartCount = 0;
        await page.route('**/api/users/1/cart', (route) => {
            getCartCount++;
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    cartItems: [{ productId: 99, name: 'Reloaded', price: 5, quantity: 1, totalPrice: 5, imageUrl: '/r.jpg' }],
                    totalValue: 5
                })
            });
        });

        await cart.goto();
        await expect(cart.cartItems).toHaveCount(1);

        await page.reload();
        await expect(cart.cartHeader).toHaveText('Koszyk');
        await expect(cart.cartItems.nth(0).locator('.item-name')).toHaveText('Reloaded');
        expect(getCartCount).toBeGreaterThanOrEqual(2);
    });

    // Weryfikuje proces wylogowania uzytkownika w pasku nawigacji.
    test('T12: Poprawne wylogowanie uzytkownika z poziomu nawigacji', async ({ page }) => {
        const nav = new TopNavbarPOM(page);

        await nav.gotoHome();
        await nav.logout();

        await expect(nav.loginLink).toBeVisible();

        const userInStorage = await page.evaluate(() => localStorage.getItem('user'));
        expect(userInStorage).not.toBeNull();

        const userObj = JSON.parse(userInStorage!);
        expect(userObj.isLoggedIn).toBe(false);
        expect(userObj.token).toBeUndefined();

        await cart.goto();
        await expect(page).not.toHaveURL(/.*checkout/);
    });
});