import { test, expect } from '@playwright/test';
import { CartPagePOM } from '../../pom/CartPagePOM';
import { TopNavbarPOM } from '../../pom/TopNavbarPOM';

test.describe('Auth state (12) - /cart (POM)', () => {
  let cart: CartPagePOM;

  test.beforeEach(async ({ page }) => {
    cart = new CartPagePOM(page);
  });

  test('A01: koszyk - naglowek widoczny', async ({ page }) => {
    await page.route('**/api/users/1/cart', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ cartItems: [], totalValue: 0 }) }),
    );

    await cart.goto();
    await expect(cart.cartHeader).toHaveText('Koszyk');
  });

  test('A02: koszyk pusty - komunikat', async ({ page }) => {
    await page.route('**/api/users/1/cart', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ cartItems: [], totalValue: 0 }) }),
    );

    await cart.goto();
    await expect(cart.emptyCartMessage).toBeVisible();
    await expect(cart.cartItems).toHaveCount(0);
  });

  test('A03: koszyk z 1 produktem - render item-name', async ({ page }) => {
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

  test('A04: koszyk z 2 produktami - count 2', async ({ page }) => {
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

  test('A05: zmiana ilosci - pokazuje toast success', async ({ page }) => {
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

  test('A06: zmiana ilosci < 1 - nie zmienia input (min=1)', async ({ page }) => {
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
    // komponent blokuje <1, wiec w praktyce value zostaje 1
    await expect(cart.quantityInputs.nth(0)).toHaveValue('1');
  });

  test('A07: usun produkt - toast success', async ({ page }) => {
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

  test('A08: suma - ma format 2 miejsca po przecinku', async ({ page }) => {
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

    test('A09: placeorder 200 - toast success', async ({ page }) => {
        let isOrdered = false;

        // 1. Mock koszyka uzale¿niony od flagi isOrdered
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

        // 2. Mock zamówienia (po klikniêciu zmieniamy flagê!)
        await page.route('**/api/orders/*/placeorder', (route) => {
            if (route.request().method() === 'POST') {
                isOrdered = true; // Zmieniamy stan na zamówiony!
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ orderId: 999, message: 'OK' }),
                });
            }
            return route.continue();
        });

        await cart.goto();

        // Teraz niezale¿nie od tego, ile razy React "mrugnie" na starcie, 
        // koszyk zawsze bêdzie mia³ 1 element, dopóki nie klikniemy.
        await expect(cart.checkoutButton).toBeVisible();
        await expect(cart.checkoutButton).toBeEnabled();

        await cart.placeOrder();

        // Sprawdzamy sukces
        await expect(page.locator('.Toastify__toast--success')).toBeVisible({ timeout: 5000 });

        // Front po sukcesie robi fetch koszyka, który teraz zwróci emptyCartMessage
        await expect(cart.emptyCartMessage).toBeVisible({ timeout: 5000 });
    });

  test('A10: placeorder 400 - toast error (brak stanu magazynu)', async ({ page }) => {
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

  test('A11: reload - nadal renderuje koszyk (storageState dziala)', async ({ page }) => {
    await page.route('**/api/users/1/cart', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ cartItems: [], totalValue: 0 }) }),
    );

    await cart.goto();
    await page.reload();
    await expect(cart.cartHeader).toHaveText('Koszyk');
  });

    test('A12: wyloguj - link Zaloguj sie widoczny (POM)', async ({ page }) => {
    const nav = new TopNavbarPOM(page);

    await nav.gotoHome();
    await nav.logout();

    await expect(nav.loginLink).toBeVisible();
  });;
});
