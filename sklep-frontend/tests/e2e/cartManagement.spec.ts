import { test, expect } from '@playwright/test';
import { CartPagePOM } from '../pom/CartPagePOM';

/**
 * Sprawdzamy:
 * - czy koszyk wyświetla produkty z cenami i ilościami,
 * - czy pusty koszyk pokazuje komunikat,
 * - czy usunięcie produktu faktycznie go usuwa,
 * - czy złożenie zamówienia pokazuje komunikat sukcesu i opróżnia koszyk.
 */

/**
 * Pomocnicza funkcja: ustawia zalogowanego użytkownika w localStorage
 * (używamy tego, żeby nie przechodzić przez formularz logowania).
 */
async function setupLoggedInUser(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const mockUser = {
      id: 1,
      name: 'testuser@example.com',
      isLoggedIn: true,
      cartItems: [],
      token: 'mock-jwt-token-for-testing',
    };
    localStorage.setItem('user', JSON.stringify(mockUser));
  });
}

/** Dane koszyka zawierające jeden produkt (mock) */
const CART_WITH_PRODUCT = {
  cartItems: [
    {
      productId: 101,
      name: 'Monstera Deliciosa',
      price: 89.99,
      quantity: 1,
      totalPrice: 89.99,
      imageUrl: '/images/monstera.jpg',
    },
  ],
  totalValue: 89.99,
};

const CART_EMPTY = { cartItems: [], totalValue: 0 };

test.describe('R3 — Zarządzanie koszykiem zakupowym', () => {

  let cartPage: CartPagePOM;

  test.beforeEach(async ({ page }) => {
    cartPage = new CartPagePOM(page);
    await setupLoggedInUser(page);
  });

  test('3.1 Koszyk wyświetla produkty z cenami, ilościami i podsumowaniem', async ({ page }) => {
    // Przygotowanie: mock API zwraca dwa produkty.
    // Oczekujemy listy produktów, cen, pól ilości, sumy i przycisku zamówienia.

    await page.route('**/api/users/1/cart', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          cartItems: [
            {
              productId: 101,
              name: 'Monstera Deliciosa',
              price: 89.99,
              quantity: 2,
              totalPrice: 179.98,
              imageUrl: '/images/monstera.jpg',
            },
            {
              productId: 102,
              name: 'Fikus Benjamina',
              price: 45.5,
              quantity: 1,
              totalPrice: 45.5,
              imageUrl: '/images/fikus.jpg',
            },
          ],
          totalValue: 225.48,
        }),
      });
    });

    await cartPage.goto();

    // Nagłówek i liczba pozycji
    await expect(cartPage.cartHeader).toHaveText('Koszyk');
    await expect(cartPage.cartItems).toHaveCount(2);

    // Sprawdź pierwszy produkt
    const firstItem = cartPage.cartItems.nth(0);
    await expect(firstItem.locator('.item-name')).toHaveText('Monstera Deliciosa');
    await expect(firstItem.locator('.item-price')).toContainText('89.99');
    await expect(firstItem.locator('input[type="number"]')).toHaveValue('2');

    // Sprawdź drugi produkt (format ceny może być bez trailing zero)
    const secondItem = cartPage.cartItems.nth(1);
    await expect(secondItem.locator('.item-name')).toHaveText('Fikus Benjamina');
    await expect(secondItem.locator('.item-price')).toContainText('45.5');
    await expect(secondItem.locator('input[type="number"]')).toHaveValue('1');

    // Podsumowanie i przycisk zamówienia
    await expect(cartPage.totalValue).toContainText('225.48');
    await expect(cartPage.checkoutButton).toBeVisible();
    await expect(cartPage.checkoutButton).toHaveText('Złóż zamówienie');

    // Każdy produkt ma przycisk usuwania
    await expect(cartPage.removeButtons).toHaveCount(2);
  });

    test('3.2 Pusty koszyk wyświetla komunikat informacyjny', async ({ page }) => {

    // Mock: API zwraca pusty koszyk.
    // Oczekujemy komunikatu "Twój koszyk jest pusty." i braku przycisku zamówienia.

    await page.route('**/api/users/1/cart', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(CART_EMPTY),
      });
    });

    await cartPage.goto();

    await expect(cartPage.emptyCartMessage).toBeVisible();
    await expect(cartPage.emptyCartMessage).toHaveText('Twój koszyk jest pusty.');
    await expect(cartPage.cartItems).toHaveCount(0);
    await expect(cartPage.checkoutButton).not.toBeVisible();
  });

  test('3.3 Usunięcie produktu z koszyka — element znika z listy', async ({ page }) => {
    // Przygotowanie: koszyk ma dwa produkty. Mockujemy DELETE, aby zwrócić sukces.
    // Po kliknięciu "Usuń" spodziewamy się jednego pozostałego elementu i toastu.

    await page.route('**/api/users/1/cart', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            cartItems: [
              {
                productId: 101,
                name: 'Monstera Deliciosa',
                price: 89.99,
                quantity: 1,
                totalPrice: 89.99,
                imageUrl: '/images/monstera.jpg',
              },
              {
                productId: 102,
                name: 'Fikus Benjamina',
                price: 45.5,
                quantity: 1,
                totalPrice: 45.5,
                imageUrl: '/images/fikus.jpg',
              },
            ],
            totalValue: 135.49,
          }),
        });
      } else {
        route.continue();
      }
    });

    // Mock DELETE dla produktu 101
    await page.route('**/api/users/1/cart/101', (route) => {
      if (route.request().method() === 'DELETE') {
        route.fulfill({ status: 200, body: '{}' });
      } else {
        route.continue();
      }
    });

    await cartPage.goto();

    // Przed usunięciem są 2 produkty
    await expect(cartPage.cartItems).toHaveCount(2);

    // Usuń pierwszy produkt
    await cartPage.removeItem(0);

    // Po usunięciu zostaje 1 produkt i jest to Fikus
    await expect(cartPage.cartItems).toHaveCount(1);
    await expect(cartPage.cartItems.nth(0).locator('.item-name')).toHaveText('Fikus Benjamina');

    // Sprawdź toast potwierdzający
    const toast = page.locator('.Toastify__toast--success');
    await expect(toast).toBeVisible({ timeout: 5000 });
  });

  test('3.4 Złożenie zamówienia — toast sukcesu i odświeżenie koszyka', async ({ page }) => {
    // Scenariusz: koszyk ma produkt. Po kliknięciu "Złóż zamówienie"
    // API placeOrder zwraca sukces, a po odświeżeniu koszyk jest pusty.
    // Oczekujemy toastu sukcesu i komunikatu o pustym koszyku.

    // Krok 1: mockujemy koszyk z jednym produktem i endpoint składania zamówienia
    await page.route('http://localhost:5000/api/users/1/cart', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(CART_WITH_PRODUCT),
      });
    });

    await page.route('http://localhost:5000/api/orders/1/placeorder', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ orderId: 999, message: 'Order placed successfully' }),
      });
    });

    await page.goto('/cart');

    // Koszyk zawiera produkt i przycisk jest aktywny
    await expect(cartPage.cartItems).toHaveCount(1, { timeout: 10000 });
    await expect(cartPage.checkoutButton).toBeEnabled();

    // Krok 2: zamieniamy mock koszyka na pusty (symulacja odświeżenia po złożeniu zamówienia)
    await page.unrouteAll({ behavior: 'ignoreErrors' });

    await page.route('http://localhost:5000/api/users/1/cart', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(CART_EMPTY),
      });
    });

    // Ponownie mockujemy placeorder (unrouteAll usunęło poprzednie)
    await page.route('http://localhost:5000/api/orders/1/placeorder', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ orderId: 999, message: 'Order placed successfully' }),
      });
    });

    // Klikamy złożenie zamówienia
    await cartPage.placeOrder();

    // Powinien pojawić się toast sukcesu
    const toast = page.locator('.Toastify__toast--success');
    await expect(toast).toBeVisible({ timeout: 5000 });

    // Koszyk powinien być pusty
    await expect(cartPage.emptyCartMessage).toBeVisible({ timeout: 5000 });
    await expect(cartPage.cartItems).toHaveCount(0);
  });
});
