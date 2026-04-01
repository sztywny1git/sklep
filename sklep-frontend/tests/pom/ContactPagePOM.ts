import { type Page, type Locator } from '@playwright/test';

/**
 * Page Object Model dla strony kontaktowej.
 * Obsługuje formularz kontaktowy z polami: imię, email, wiadomość.
 */
export class ContactPagePOM {
  readonly page: Page;
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly messageTextarea: Locator;
  readonly submitButton: Locator;
  readonly successMessage: Locator;
  readonly errorMessage: Locator;
  readonly contactHeader: Locator;
  readonly contactDetails: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nameInput = page.locator('#name');
    this.emailInput = page.locator('#email');
    this.messageTextarea = page.locator('#message');
    this.submitButton = page.locator('button[type="submit"]');
    this.successMessage = page.locator('.success');
    this.errorMessage = page.locator('.error');
    this.contactHeader = page.locator('.contact-header');
    this.contactDetails = page.locator('.contact-details');
  }

  async goto() {
    await this.page.goto('/contact');
  }

  async fillForm(name: string, email: string, message: string) {
    await this.nameInput.fill(name);
    await this.emailInput.fill(email);
    await this.messageTextarea.fill(message);
  }

  async submitForm() {
    await this.submitButton.click();
  }

  async clearField(field: 'name' | 'email' | 'message') {
    const locators = {
      name: this.nameInput,
      email: this.emailInput,
      message: this.messageTextarea,
    };
    await locators[field].clear();
  }
}
