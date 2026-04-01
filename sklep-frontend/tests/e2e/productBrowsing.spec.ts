import { test, expect } from '@playwright/test';
import { ProductShopPagePOM } from '../pom/ProductShopPagePOM';

/**
 * Sprawdzamy:
 * - czy strona sklepu pokazuje listę kategorii,
 * - czy kliknięcie kategorii ładuje produkty z pełnymi danymi,
 * - czy zmiana kategorii pokazuje inne produkty,
 * - czy błąd API jest obsługiwany i wyświetlany użytkownikowi.
 */

test.describe('R2 — Przeglądanie produktów według kategorii', () => {

  let shopPage: ProductShopPagePOM;

  test.beforeEach(async ({ page }) => {
    shopPage = new ProductShopPagePOM(page);
  });

  test('2.1 Strona sklepu wyświetla listę kategorii z API', async ({ page }) => {
    // Mockujemy API kategorii, które zwraca 3 pozycje.
    // Oczekujemy nagłówka i trzech elementów listy.

    await page.route('**/api/categories', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, name: 'Rośliny doniczkowe' },
          { id: 2, name: 'Kaktusy i sukulenty' },
          { id: 3, name: 'Rośliny ogrodowe' },
        ]),
      });
    });

    await shopPage.goto();

    // Sprawdź nagłówek i liczbę kategorii
    await expect(shopPage.categoryHeader).toBeVisible();
    await expect(shopPage.categoryHeader).toHaveText('Kategorie');
    await expect(shopPage.categoryItems).toHaveCount(3);

    // Sprawdź nazwy kategorii
    await expect(shopPage.categoryItems.nth(0)).toHaveText('Rośliny doniczkowe');
    await expect(shopPage.categoryItems.nth(1)).toHaveText('Kaktusy i sukulenty');
    await expect(shopPage.categoryItems.nth(2)).toHaveText('Rośliny ogrodowe');
  });

  test('2.2 Kliknięcie kategorii ładuje produkty z pełnymi danymi', async ({ page }) => {
    // Mock kategorii i produktów dla kategorii 1.
    // Po kliknięciu kategorii oczekujemy dwóch kart produktowych z pełnymi danymi.

    await page.route('**/api/categories', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, name: 'Rośliny doniczkowe' },
          { id: 2, name: 'Kaktusy i sukulenty' },
        ]),
      });
    });

    await page.route('**/api/products/category/1', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 101,
            name: 'Monstera Deliciosa',
            price: 89.99,
            description: 'Piękna roślina tropikalna z dużymi liśćmi.',
            imageUrl: '/images/monstera.jpg',
            stockQuantity: 15,
            categoryId: 1,
            category: { id: 1, name: 'Rośliny doniczkowe' },
          },
          {
            id: 102,
            name: 'Fikus Benjamina',
            price: 45.50,
            description: 'Elegancka roślina doniczkowa, idealna do biura.',
            imageUrl: '/images/fikus.jpg',
            stockQuantity: 8,
            categoryId: 1,
            category: { id: 1, name: 'Rośliny doniczkowe' },
          },
        ]),
      });
    });

    await shopPage.goto();

    // Wybierz kategorię i poczekaj na produkty
    await shopPage.selectCategoryByName('Rośliny doniczkowe');
    await expect(shopPage.productItems).toHaveCount(2);

    // Sprawdź pierwszy produkt — pełne informacje
    const firstProduct = shopPage.productItems.nth(0);
    await expect(firstProduct.locator('.product-name')).toHaveText('Monstera Deliciosa');
    await expect(firstProduct.locator('.product-description')).toHaveText(
      'Piękna roślina tropikalna z dużymi liśćmi.'
    );
    await expect(firstProduct.locator('.product-price')).toHaveText('89.99 zł');
    await expect(firstProduct.locator('.product-quantity')).toContainText('15');
    await expect(firstProduct.locator('.product-image')).toBeVisible();
    await expect(firstProduct.locator('.add-to-cart-button')).toHaveText('Dodaj do koszyka');

    // Sprawdź drugi produkt — nazwa i cena
    const secondProduct = shopPage.productItems.nth(1);
    await expect(secondProduct.locator('.product-name')).toHaveText('Fikus Benjamina');
    await expect(secondProduct.locator('.product-price')).toHaveText('45.50 zł');
  });

  test('2.3 Zmiana kategorii powoduje załadowanie nowych produktów', async ({ page }) => {
    // Mock kategorii oraz produktów dla kategorii 1 i 2.
    // Wybieramy kategorię 1, potem kategorię 2 i sprawdzamy, że lista się zmienia.

    await page.route('**/api/categories', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, name: 'Rośliny doniczkowe' },
          { id: 2, name: 'Kaktusy i sukulenty' },
        ]),
      });
    });

    await page.route('**/api/products/category/1', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 101, name: 'Monstera Deliciosa', price: 89.99,
            description: 'Tropikalna roślina', imageUrl: '/images/monstera.jpg',
            stockQuantity: 15, categoryId: 1, category: null,
          },
          {
            id: 102, name: 'Fikus Benjamina', price: 45.50,
            description: 'Roślina biurowa', imageUrl: '/images/fikus.jpg',
            stockQuantity: 8, categoryId: 1, category: null,
          },
        ]),
      });
    });

    await page.route('**/api/products/category/2', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 201, name: 'Kaktus Pustynny', price: 29.99,
            description: 'Mały kaktus, łatwy w pielęgnacji', imageUrl: '/images/kaktus.jpg',
            stockQuantity: 25, categoryId: 2, category: null,
          },
        ]),
      });
    });

    await shopPage.goto();

    // Wybierz pierwszą kategorię i zapamiętaj produkty
    await shopPage.selectCategoryByName('Rośliny doniczkowe');
    await expect(shopPage.productItems).toHaveCount(2);
    const firstCategoryProducts = await shopPage.getProductNames();
    expect(firstCategoryProducts).toContain('Monstera Deliciosa');

    // Przełącz na drugą kategorię i sprawdź nowe produkty
    await shopPage.selectCategoryByName('Kaktusy i sukulenty');
    await expect(shopPage.productItems).toHaveCount(1);
    const secondCategoryProducts = await shopPage.getProductNames();
    expect(secondCategoryProducts).toContain('Kaktus Pustynny');
    expect(secondCategoryProducts).not.toContain('Monstera Deliciosa');
  });

  test('2.4 Błąd API kategorii wyświetla komunikat o problemie', async ({ page }) => {
    // Mockujemy błąd 500 z endpointu kategorii.
    // Oczekujemy widocznego komunikatu o błędzie i braku listy kategorii.

    await page.route('**/api/categories', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal Server Error' }),
      });
    });

    await shopPage.goto();

    // Komunikat o błędzie powinien być widoczny
    await expect(page.getByText('Error fetching categories')).toBeVisible();

    // Nie powinno być kategorii w liście
    await expect(shopPage.categoryItems).toHaveCount(0);
  });
});
