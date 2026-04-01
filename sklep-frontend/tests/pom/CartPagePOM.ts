import { type Page, type Locator } from '@playwright/test';

/**
 * Page Object Model dla strony koszyka.
 * Obsługuje: wyświetlanie elementów koszyka, zmianę ilości, usuwanie, składanie zamówień.
 */
export class CartPagePOM {
  readonly page: Page;
  readonly cartContainer: Locator;
  readonly cartItems: Locator;
  readonly emptyCartMessage: Locator;
  readonly totalValue: Locator;
  readonly checkoutButton: Locator;
  readonly removeButtons: Locator;
  readonly quantityInputs: Locator;
  readonly cartHeader: Locator;

  constructor(page: Page) {
    this.page = page;
    this.cartContainer = page.locator('.basket-container');
    this.cartItems = page.locator('.cart-item');
    this.emptyCartMessage = page.getByText('Twój koszyk jest pusty.');
    this.totalValue = page.locator('.cart-summary h3');
    this.checkoutButton = page.locator('.checkout-button');
    this.removeButtons = page.locator('.remove-button');
    this.quantityInputs = page.locator('.item-controls input[type="number"]');
    this.cartHeader = page.locator('.basket-container h1');
  }

  async goto() {
    await this.page.goto('/cart');
  }

  async changeQuantity(itemIndex: number, newQuantity: number) {
    await this.quantityInputs.nth(itemIndex).fill(String(newQuantity));
  }

  async removeItem(itemIndex: number) {
    await this.removeButtons.nth(itemIndex).click();
  }

  async placeOrder() {
    await this.checkoutButton.click();
  }

  async getItemNames(): Promise<string[]> {
    return this.page.locator('.item-name').allTextContents();
  }

  async getItemPrices(): Promise<string[]> {
    return this.page.locator('.item-price').allTextContents();
  }
}
