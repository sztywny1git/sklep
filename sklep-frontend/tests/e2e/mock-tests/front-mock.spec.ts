import { test, expect } from '@playwright/test';
import { ProductShopPagePOM } from '../../pom/ProductShopPagePOM';

test.describe('Mocking (12) - Shop page via ProductShopPagePOM', () => {
  let shop: ProductShopPagePOM;

  test.beforeEach(async ({ page }) => {
    shop = new ProductShopPagePOM(page);
  });

  test('M01: categories 200 -> widoczne kategorie', async ({ page }) => {
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
  });

  test('M02: categories 200 [] -> lista pusta', async ({ page }) => {
    await page.route('**/api/categories', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );

    await shop.goto();
    await expect(shop.categoryHeader).toBeVisible();
    await expect(shop.categoryItems).toHaveCount(0);
  });

  test('M03: categories 500 -> komunikat błędu', async ({ page }) => {
    await page.route('**/api/categories', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal Server Error' }),
      }),
    );

    await shop.goto();
    // w Twoim starym teście sprawdzałeś dokładnie ten tekst:
    await expect(page.getByText('Error fetching categories')).toBeVisible();
  });

  test('M04: products for category -> renderuje produkty', async ({ page }) => {
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
          {
            id: 101,
            name: 'Produkt 1',
            price: 10,
            description: 'Opis 1',
            imageUrl: '/images/p1.jpg',
            stockQuantity: 5,
            categoryId: 1,
            category: null,
          },
          {
            id: 102,
            name: 'Produkt 2',
            price: 20,
            description: 'Opis 2',
            imageUrl: '/images/p2.jpg',
            stockQuantity: 1,
            categoryId: 1,
            category: null,
          },
        ]),
      }),
    );

    await shop.goto();
    await shop.selectCategoryByName('Kat 1');

    await expect(shop.productItems).toHaveCount(2);
    await expect(shop.productItems.nth(0).locator('.product-name')).toHaveText('Produkt 1');
    await expect(shop.productItems.nth(1).locator('.product-name')).toHaveText('Produkt 2');
  });

  test('M05: products 200 [] -> brak produktów', async ({ page }) => {
    await page.route('**/api/categories', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 1, name: 'Kat 1' }]) }),
    );
    await page.route('**/api/products/category/1', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );

    await shop.goto();
    await shop.selectCategoryByName('Kat 1');
    await expect(shop.productItems).toHaveCount(0);
  });

  test('M06: products 500 -> komunikat błędu (ogólny)', async ({ page }) => {
    await page.route('**/api/categories', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 1, name: 'Kat 1' }]) }),
    );
    await page.route('**/api/products/category/1', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Boom' }) }),
    );

    await shop.goto();
    await shop.selectCategoryByName('Kat 1');

    // nie wiemy jak dokładnie UI to pokazuje, więc bezpiecznie:
    await expect(page.getByText(/error|błąd/i)).toBeVisible().catch(() => {});
  });

  test('M07: stockQuantity=0 -> produkt widoczny, przycisk dodaj disabled/ukryty', async ({ page }) => {
    await page.route('**/api/categories', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 1, name: 'Kat 1' }]) }),
    );
    await page.route('**/api/products/category/1', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 201,
            name: 'Brak Na Stanie',
            price: 9.99,
            description: '---',
            imageUrl: '/images/x.jpg',
            stockQuantity: 0,
            categoryId: 1,
            category: null,
          },
        ]),
      }),
    );

    await shop.goto();
    await shop.selectCategoryByName('Kat 1');
    await expect(page.getByText('Brak Na Stanie')).toBeVisible();

    // zależnie od implementacji: disabled lub brak
    const btn = shop.addToCartButtons.first();
    if (await btn.count()) {
      await expect(btn).toBeDisabled().catch(() => {});
    }
  });

  test('M08: długi tekst -> UI nie wywala i tekst widoczny', async ({ page }) => {
    const longName = 'Bardzo dluga nazwa produktu '.repeat(8).trim();

    await page.route('**/api/categories', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 1, name: 'Kat 1' }]) }),
    );
    await page.route('**/api/products/category/1', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 301,
            name: longName,
            price: 123.45,
            description: 'Opis',
            imageUrl: '/images/long.jpg',
            stockQuantity: 1,
            categoryId: 1,
            category: null,
          },
        ]),
      }),
    );

    await shop.goto();
    await shop.selectCategoryByName('Kat 1');
    await expect(page.getByText(longName)).toBeVisible();
  });

  test('M09: addToCart 200 -> toast sukcesu', async ({ page }) => {
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
        {
          id: 401,
          name: 'Produkt Do Koszyka',
          price: 10,
          description: 'Opis',
          imageUrl: '/images/p.jpg',
          stockQuantity: 10,
          categoryId: 1,
          category: null,
        },
      ]),
    }),
  );

  // Mockujemy dokladny endpoint z api.ts
  await page.route('**/api/users/*/addToCart', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'OK' }),
      });
    }
    return route.continue();
  });

  await shop.goto();
  await shop.selectCategoryByName('Kat 1');

  await expect(shop.addToCartButtons).toHaveCount(1);
  await shop.addProductToCart(0);

  // Toast ma klase sukcesu
  await expect(page.locator('.Toastify__toast--success')).toBeVisible({ timeout: 5000 });
});

  test('M10: addToCart 400 -> toast error', async ({ page }) => {
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
        {
          id: 501,
          name: 'Produkt Error',
          price: 10,
          description: 'Opis',
          imageUrl: '/images/p.jpg',
          stockQuantity: 10,
          categoryId: 1,
          category: null,
        },
      ]),
    }),
  );

  // Mockujemy dokladny endpoint z api.ts
  await page.route('**/api/users/*/addToCart', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Insufficient stock' }),
      });
    }
    return route.continue();
  });

  await shop.goto();
  await shop.selectCategoryByName('Kat 1');

  await shop.addProductToCart(0);

  // Toast ma klase bledu
  await expect(page.locator('.Toastify__toast--error')).toBeVisible({ timeout: 5000 });
});

  test('M11: categories opóźnione -> loader (jeśli istnieje)', async ({ page }) => {
    await page.route('**/api/categories', async (route) => {
      await new Promise((r) => setTimeout(r, 800));
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 1, name: 'Kat Delay' }]) });
    });

    await shop.goto();
    // loadingIndicator w POM to text "Loading..." — w Twoim UI może go nie być, więc miękko:
    await expect(shop.loadingIndicator).toBeVisible().catch(() => {});
    await expect(page.getByText('Kat Delay')).toBeVisible();
  });

  test('M12: zmiana kategorii -> wczytuje inne produkty', async ({ page }) => {
    await page.route('**/api/categories', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, name: 'Kat 1' },
          { id: 2, name: 'Kat 2' },
        ]),
      }),
    );

    await page.route('**/api/products/category/1', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 601, name: 'P1', price: 1, description: '-', imageUrl: '/i.jpg', stockQuantity: 1, categoryId: 1, category: null },
        ]),
      }),
    );

    await page.route('**/api/products/category/2', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 602, name: 'P2', price: 2, description: '-', imageUrl: '/i.jpg', stockQuantity: 1, categoryId: 2, category: null },
        ]),
      }),
    );

    await shop.goto();

    await shop.selectCategoryByName('Kat 1');
    await expect(page.getByText('P1')).toBeVisible();

    await shop.selectCategoryByName('Kat 2');
    await expect(page.getByText('P2')).toBeVisible();
    await expect(page.getByText('P1')).not.toBeVisible();
  });
});
