import { test, expect } from '@playwright/test';
import { ContactPagePOM } from '../pom/ContactPagePOM';

/**
 * Sprawdzamy:
 * czy strona /contact pokazuje nagłówek, dane kontaktowe, formularz i mapę,
 * czy formularz blokuje wysyłkę gdy pola są puste (HTML5 required),
 * czy poprawne wysłanie pokazuje komunikat sukcesu i czyści pola,
 * czy niepoprawny email blokuje wysyłkę (input type="email").
 */

test.describe('R1 — Formularz kontaktowy: walidacja i wysyłanie', () => {

  let contactPage: ContactPagePOM;

  test.beforeEach(async ({ page }) => {
    contactPage = new ContactPagePOM(page);
    await contactPage.goto();
  });

  test('1.1 Strona kontaktowa wyświetla dane firmy, formularz i mapę', async ({ page }) => {
    // Wejdź na stronę kontaktu i sprawdź widoczne elementy.

    // Nagłówek strony
    await expect(contactPage.contactHeader).toBeVisible();
    await expect(contactPage.contactHeader).toHaveText('Skontaktuj sie z nami!');

    // Dane kontaktowe firmy
    await expect(contactPage.contactDetails).toContainText('Ul. Wiejska 45a');
    await expect(contactPage.contactDetails).toContainText('kontakt@plantshop.pl');
    await expect(contactPage.contactDetails).toContainText('+48 123 456 789');

    // Formularz — pola i przycisk
    await expect(contactPage.nameInput).toBeVisible();
    await expect(contactPage.emailInput).toBeVisible();
    await expect(contactPage.messageTextarea).toBeVisible();
    await expect(contactPage.submitButton).toBeVisible();
    await expect(contactPage.submitButton).toHaveText('Wyslij wiadomosc');

    // Mapa powinna być widoczna
    const mapContainer = page.locator('.map');
    await expect(mapContainer).toBeVisible();
  });

  test('1.2 Walidacja — pusty formularz nie wysyła się (HTML5 required)', async ({ page }) => {
    // Klikamy "Wyślij" bez wprowadzania danych formularz powinien być zablokowany.
    await contactPage.submitForm();

    // Nie powinno być komunikatu sukcesu
    await expect(contactPage.successMessage).not.toBeVisible();

    // Pole "name" powinno mieć atrybut required i być puste
    await expect(contactPage.nameInput).toHaveAttribute('required', '');
    await expect(contactPage.nameInput).toHaveValue('');
  });

  test('1.3 Poprawne wysłanie formularza — sukces i wyczyszczenie pól', async () => {
    // Wypełnij pola poprawnymi danymi i wyślij spodziewamy się sukcesu i wyczyszczenia formularza.

    // Wypełnienie formularza
    await contactPage.fillForm(
      'Jan Testowy',
      'jan.testowy@example.com',
      'Chciałbym dowiedzieć się więcej o waszych roślinach doniczkowych.'
    );

    // Sprawdź, że pola zawierają wpisane wartości
    await expect(contactPage.nameInput).toHaveValue('Jan Testowy');
    await expect(contactPage.emailInput).toHaveValue('jan.testowy@example.com');

    // Wysłanie
    await contactPage.submitForm();

    // Powinien pokazać się komunikat sukcesu
    await expect(contactPage.successMessage).toBeVisible();

    // Po wysłaniu pola powinny być puste
    await expect(contactPage.nameInput).toHaveValue('');
    await expect(contactPage.emailInput).toHaveValue('');
    await expect(contactPage.messageTextarea).toHaveValue('');
  });

  test('1.4 Walidacja email — niepoprawny format blokuje wysłanie', async ({ page }) => {
    // Podaj nieprawidłowy email i sprawdź, że przeglądarka blokuje wysłanie (type="email").

    await contactPage.fillForm(
      'Anna Testowa',
      'niepoprawny-email',
      'Testowa wiadomość'
    );

    await contactPage.submitForm();

    // Pole email powinno mieć type="email" (przeglądarka waliduje format)
    await expect(contactPage.emailInput).toHaveAttribute('type', 'email');

    // Komunikat sukcesu nie powinien się pojawić
    await expect(contactPage.successMessage).not.toBeVisible();
  });
});
