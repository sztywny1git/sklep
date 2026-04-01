import { type Page, type Locator } from '@playwright/test';

/**
 * Page Object Model dla strony produktów (sklep).
 * Obsługuje listę kategorii, wyświetlanie produktów i dodawanie do koszyka.
 */
export class ProductShopPagePOM {
  readonly page: Page;
  readonly categoryListContainer: Locator;
  readonly categoryItems: Locator;
  readonly productListContainer: Locator;
  readonly productItems: Locator;
  readonly addToCartButtons: Locator;
  readonly loadingIndicator: Locator;
  readonly errorMessage: Locator;
  readonly categoryHeader: Locator;

  constructor(page: Page) {
    this.page = page;
    this.categoryListContainer = page.locator('.category-list-container');
    this.categoryItems = page.locator('.category-item');
    this.productListContainer = page.locator('.product-list-container');
    this.productItems = page.locator('.product-item');
    this.addToCartButtons = page.locator('.add-to-cart-button');
    this.loadingIndicator = page.getByText('Loading...');
    this.errorMessage = page.getByText('Error fetching');
    this.categoryHeader = page.locator('.category-list-container h1');
  }

  async goto() {
    await this.page.goto('/shop');
  }

  async selectCategory(index: number) {
    await this.categoryItems.nth(index).click();
  }

  async selectCategoryByName(name: string) {
    await this.categoryItems.filter({ hasText: name }).click();
  }

  async getProductNames(): Promise<string[]> {
    return this.page.locator('.product-name').allTextContents();
  }

  async getProductPrices(): Promise<string[]> {
    return this.page.locator('.product-price').allTextContents();
  }

  async getProductStockInfo(): Promise<string[]> {
    return this.page.locator('.product-quantity').allTextContents();
  }

  async addProductToCart(index: number) {
    await this.addToCartButtons.nth(index).click();
  }
}
