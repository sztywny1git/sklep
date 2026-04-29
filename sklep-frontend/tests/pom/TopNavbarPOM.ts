import { type Page, type Locator } from '@playwright/test';


export class TopNavbarPOM {
  readonly page: Page;

  readonly loginLink: Locator;
  readonly profileLink: Locator;
  readonly cartLink: Locator;
  readonly logoutLink: Locator;

  constructor(page: Page) {
    this.page = page;

    this.loginLink = page.getByRole('link', { name: 'Zaloguj się' });
    this.profileLink = page.getByRole('link', { name: 'Profil' });
    this.cartLink = page.getByRole('link', { name: 'Koszyk' });
    this.logoutLink = page.getByRole('link', { name: 'Wyloguj się' });
  }

  async gotoHome() {
    await this.page.goto('/');
  }

  async logout() {
    await this.logoutLink.click();
  }
}
