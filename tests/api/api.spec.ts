import { test, expect } from '@playwright/test';

// Funkcja pomocnicza do tworzenia i logowania użytkownika
async function createAndLoginUser(request: any) {
    const email = `user_${Date.now()}@example.com`;
    const password = "Password123!";

    await request.post('/api/users/register', {
        data: { username: "TestUser", email, password }
    });

    const res = await request.post('/api/users/login', {
        data: { email, password }
    });

    const body = await res.json();
    return { email, password, token: body.token, userId: body.userId };
}

test.describe('Testy Integracyjne API (Backend)', () => {

    // Testy 1-3 - Patryk

    // Weryfikacja pełnego procesu rejestracji, logowania oraz trwałości danych użytkownika w bazie.
    test('T01: Poprawna rejestracja nowego użytkownika i weryfikacja persystencji danych', async ({ request }) => {
        const email = `nowy_${Date.now()}@example.com`;
        const password = "Password123!";
        const username = "NowyUser";

        // Rejestracja nowego konta
        const regResponse = await request.post('/api/users/register', {
            data: { username, email, password }
        });

        expect(regResponse.status()).toBe(200);
        const regBody = await regResponse.json();
        expect(regBody).toHaveProperty('message', 'Registration successful');

        // Próba zalogowania na nowo utworzone dane
        const loginResponse = await request.post('/api/users/login', {
            data: { email, password }
        });

        expect(loginResponse.status()).toBe(200);
        const loginBody = await loginResponse.json();

        expect(loginBody).toHaveProperty('token');
        expect(loginBody).toHaveProperty('userId');
        const nowoZarejestrowanyUserId = loginBody.userId;

        // Odczyt danych użytkownika z bazy przez API i porównanie z danymi wejściowymi
        const userResponse = await request.get(`/api/users/${nowoZarejestrowanyUserId}`);
        expect(userResponse.status()).toBe(200);

        const userBody = await userResponse.json();
        expect(userBody.id).toBe(nowoZarejestrowanyUserId);
        expect(userBody.email).toBe(email);
        expect(userBody.username).toBe(username);
        expect(userBody.passwordHash).toBeDefined();
        expect(userBody.passwordHash).not.toBe(password); // Hasło musi być zahashowane
    });

    // Sprawdzenie obsługi błędów dla nieistniejącego zasobu (404) oraz walidacji formatu identyfikatora (400).
    test('T02: Pobieranie produktu - obsługa braku zasobu (404) oraz błędnego formatu ID (400)', async ({ request }) => {

        // Próba pobrania produktu o ID, którego nie ma w bazie
        const notFoundRes = await request.get('/api/products/9999999');

        expect(notFoundRes.status()).toBe(404);

        const notFoundBody = await notFoundRes.json();
        expect(notFoundBody).toHaveProperty('title', 'Not Found');
        expect(notFoundBody).toHaveProperty('status', 404);
        expect(notFoundBody).toHaveProperty('traceId');

        expect(notFoundRes.headers()['content-type']).toContain('application/problem+json');

        // Próba użycia ID w formacie tekstowym zamiast liczbowym
        const badRequestRes = await request.get('/api/products/invalid_id_format');
        expect(badRequestRes.status()).toBe(400);

        const badRequestBody = await badRequestRes.json();
        expect(badRequestBody).toHaveProperty('title');
        expect(badRequestBody).toHaveProperty('status', 400);
        expect(badRequestBody).toHaveProperty('errors');

        expect(badRequestBody.errors).toHaveProperty('id');
    });

    // Weryfikacja struktury modelu danych i typów pól dla produktu pobranego z bazy danych.
    test('T03: Pobranie istniejącego produktu i sprawdzenie jego właściwości', async ({ request }) => {
        // Pobranie listy, aby wyciągnąć istniejące ID
        const listRes = await request.get('/api/products');
        const list = await listRes.json();

        if (list.length > 0) {
            const firstProductId = list[0].id;
            const response = await request.get(`/api/products/${firstProductId}`);
            expect(response.status()).toBe(200);

            // Sprawdzenie czy pola mają poprawne typy danych
            const body = await response.json();
            expect(body.id).toBe(firstProductId);
            expect(typeof body.name).toBe('string');
            expect(typeof body.price).toBe('number');
            expect(typeof body.stockQuantity).toBe('number');
            expect(typeof body.categoryId).toBe('number');
        }
    });

    // Testy 4-6 - Martyna

    // Testowanie negatywnych scenariuszy logowania: błędne poświadczenia, nieistniejące konto oraz brak danych wejściowych.
    test('T04: Logowanie - obsługa błędnego hasła, nieistniejącego konta oraz weryfikacja bezpieczeństwa', async ({ request }) => {
        const { email } = await createAndLoginUser(request);

        // Test błędnego hasła
        const wrongPassRes = await request.post('/api/users/login', {
            data: { email, password: "WrongPassword!" }
        });

        expect(wrongPassRes.status()).toBe(401);
        const wrongPassText = await wrongPassRes.text();
        expect(wrongPassText).toContain("Invalid credentials.");

        // Test nieistniejącego e-maila
        const fakeEmailRes = await request.post('/api/users/login', {
            data: { email: "kompletnie_nieznany@example.com", password: "Password123!" }
        });

        expect(fakeEmailRes.status()).toBe(401);
        const fakeEmailText = await fakeEmailRes.text();
        expect(fakeEmailText).toContain("Invalid credentials.");

        // Test pustego body
        const emptyPayloadRes = await request.post('/api/users/login', {
            data: {}
        });

        expect(emptyPayloadRes.status()).toBe(400);
        const emptyPayloadBody = await emptyPayloadRes.json();
        expect(emptyPayloadBody).toHaveProperty('title');
    });

    // Sprawdzenie mechanizmu unikalności adresu e-mail oraz upewnienie się, że próba duplikacji nie wpływa na oryginalne konto.
    test('T05: Rejestracja - zablokowanie duplikatu e-maila z udowodnieniem braku skutków ubocznych w bazie', async ({ request }) => {
        const email = `duplicate_${Date.now()}@example.com`;
        const originalPassword = "OriginalPassword123!";

        // Pierwsza rejestracja
        await request.post('/api/users/register', {
            data: { username: "OryginalnyUser", email, password: originalPassword }
        });

        // Próba rejestracji na ten sam e-mail
        const hackerPassword = "HackerPassword999!";
        const duplicateRes = await request.post('/api/users/register', {
            data: { username: "Hacker", email, password: hackerPassword }
        });

        expect(duplicateRes.status()).toBe(400);
        const duplicateText = await duplicateRes.text();
        expect(duplicateText).toContain("User already exists.");

        const hackLoginRes = await request.post('/api/users/login', {
            data: { email, password: hackerPassword }
        });
        expect(hackLoginRes.status()).toBe(401);

        // Weryfikacja: oryginalne hasło nadal działa
        const validLoginRes = await request.post('/api/users/login', {
            data: { email, password: originalPassword }
        });
        expect(validLoginRes.status()).toBe(200);
        const validLoginBody = await validLoginRes.json();
        expect(validLoginBody).toHaveProperty('token');
    });

    // Weryfikacja filtrowania produktów według kategorii oraz poprawności relacji klucza obcego.
    test('T06: Pobranie produktów z określonej kategorii z walidacją relacji', async ({ request }) => {
        // Pobranie kategorii, aby znać poprawne ID
        const categoriesRes = await request.get('/api/categories');
        const categories = await categoriesRes.json();

        if (categories.length > 0) {
            const categoryId = categories[0].id;
            const productsRes = await request.get(`/api/products/Category/${categoryId}`);

            expect(productsRes.status()).toBe(200);
            const products = await productsRes.json();

            // Sprawdzenie czy każdy produkt z listy faktycznie ma przypisane to categoryId
            if (products.length > 0) {
                products.forEach(p => {
                    expect(p.categoryId).toBe(categoryId);
                });
            }
        }
    });

    // Testy 7-9 - Łukasz

    // Walidacja poprawności struktury obiektu zwrotnego po udanym logowaniu (obecność tokena i identyfikatora użytkownika).
    test('T07: Logowanie poprawnym emailem z walidacją obiektu zwrotnego', async ({ request }) => {
        const email = `token_user_${Date.now()}@example.com`;
        const password = "Password123!";
        await request.post('/api/users/register', { data: { username: "TUser", email, password } });

        // Logowanie i sprawdzenie body odpowiedzi
        const response = await request.post('/api/users/login', {
            data: { email, password }
        });

        expect(response.status()).toBe(200);

        const body = await response.json();
        expect(body).toHaveProperty('token');
        expect(body).toHaveProperty('userId');
        expect(body.userId).toBeGreaterThan(0);
        expect(typeof body.token).toBe('string');
    });

    // Weryfikacja procesu dodawania pozycji do koszyka wraz z przeliczeniem wartości pozycji (cena * ilość) i sumy całkowitej.
    test('T08: Dodanie produktu do koszyka i szczegółowa weryfikacja logiki koszyka', async ({ request }) => {
        const { token, userId } = await createAndLoginUser(request);
        const listRes = await request.get('/api/products');
        const list = await listRes.json();

        // Znalezienie produktu dostępnego w magazynie
        const product = list.find((p: any) => p.stockQuantity >= 2);
        expect(product, 'Brak produktu z wystarczającą ilością w magazynie').toBeDefined();

        // Dodanie do koszyka z Bearer Tokenem
        const addResponse = await request.post(`/api/users/${userId}/addToCart`, {
            headers: { 'Authorization': `Bearer ${token}` },
            data: { productId: product.id, quantity: 2 }
        });

        expect(addResponse.status()).toBe(200);
        expect(await addResponse.json()).toBe("Item added to cart.");

        // Sprawdzenie zawartości koszyka i poprawności obliczeń TotalPrice
        const cartRes = await request.get(`/api/users/${userId}/cart`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const cartBody = await cartRes.json();

        expect(cartBody.cartItems.length).toBe(1);
        expect(cartBody.cartItems[0].productId).toBe(product.id);
        expect(cartBody.cartItems[0].quantity).toBe(2);

        const expectedItemTotal = 2 * product.price;
        expect(cartBody.cartItems[0].totalPrice).toBe(expectedItemTotal);
        expect(cartBody.totalValue).toBe(expectedItemTotal);
    });

    // Sprawdzenie poprawności usuwania pozycji z koszyka oraz weryfikacja stanu pustego koszyka po operacji.
    test('T09: Usunięcie istniejącej pozycji z koszyka i weryfikacja usunięcia', async ({ request }) => {
        const { token, userId } = await createAndLoginUser(request);
        const listRes = await request.get('/api/products');
        const productId = (await listRes.json())[0].id;

        // Dodanie przedmiotu, aby móc go usunąć
        await request.post(`/api/users/${userId}/addToCart`, {
            headers: { 'Authorization': `Bearer ${token}` },
            data: { productId, quantity: 1 }
        });

        // Usunięcie pozycji
        const delResponse = await request.delete(`/api/users/${userId}/cart/${productId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        expect(delResponse.status()).toBe(200);

        const delBody = await delResponse.json();
        expect(delBody.message).toBe("Item removed from cart.");

        // Sprawdzenie czy koszyk jest pusty
        const cartRes = await request.get(`/api/users/${userId}/cart`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const cartBody = await cartRes.json();

        expect(cartBody.cartItems.length).toBe(0);
        expect(cartBody.totalValue).toBeUndefined();
    });

    // Testy 10-12 - Paweł

    // Walidacja procesu finalizacji zamówienia oraz potwierdzenie automatycznego czyszczenia zawartości koszyka.
    test('T10: Złożenie zamówienia i weryfikacja logiki wyczyszczenia koszyka', async ({ request }) => {
        const { token, userId } = await createAndLoginUser(request);
        const listRes = await request.get('/api/products');
        const productId = (await listRes.json())[0].id;

        // Budowanie koszyka przed zamówieniem
        await request.post(`/api/users/${userId}/addToCart`, {
            headers: { 'Authorization': `Bearer ${token}` },
            data: { productId, quantity: 1 }
        });

        // Wysłanie żądania złożenia zamówienia
        const orderRes = await request.post(`/api/orders/${userId}/placeorder`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        expect(orderRes.status()).toBe(200);

        const orderBody = await orderRes.json();
        expect(orderBody.message).toBe("Order placed successfully.");
        expect(typeof orderBody.orderId).toBe('number');

        // Sprawdzenie czy koszyk został wyczyszczony po złożeniu zamówienia
        const cartRes = await request.get(`/api/users/${userId}/cart`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const cartBody = await cartRes.json();

        expect(cartBody.cartItems.length).toBe(0);
        expect(cartBody.totalValue).toBeUndefined();
    });

    // Weryfikacja reguły biznesowej uniemożliwiającej dodanie do koszyka ilości produktu przekraczającej dostępny stan magazynowy.
    test('T11: Odrzucenie dodania produktu do koszyka z powodu niewystarczającego stanu', async ({ request }) => {
        const { token, userId } = await createAndLoginUser(request);
        const listRes = await request.get('/api/products');
        const product = (await listRes.json())[0];

        // Próba dodania o 1 więcej niż dostępny stock
        const impossibleQuantity = product.stockQuantity + 1;

        const response = await request.post(`/api/users/${userId}/addToCart`, {
            headers: { 'Authorization': `Bearer ${token}` },
            data: { productId: product.id, quantity: impossibleQuantity }
        });

        expect(response.status()).toBe(400);

        const text = await response.text();
        expect(text).toContain("Insufficient stock.");
    });

    // Sprawdzenie poprawności mapowania danych zamówienia do obiektu DTO w historii zakupów użytkownika.
    test('T12: Poprawne zmapowanie danych historii zamówień (DTO)', async ({ request }) => {
        const { token, userId } = await createAndLoginUser(request);
        const listRes = await request.get('/api/products');
        const product = (await listRes.json())[0];

        // Cykl: Koszyk -> Zamówienie
        await request.post(`/api/users/${userId}/addToCart`, {
            headers: { 'Authorization': `Bearer ${token}` },
            data: { productId: product.id, quantity: 1 }
        });

        const orderRes = await request.post(`/api/orders/${userId}/placeorder`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const orderId = (await orderRes.json()).orderId;

        // Pobranie listy zamówień i weryfikacja właściwości obiektu DTO
        const historyRes = await request.get(`/api/orders/${userId}/orders`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        expect(historyRes.status()).toBe(200);
        const historyBody = await historyRes.json();

        const myOrder = historyBody.find(o => o.id === orderId);
        expect(myOrder).toBeDefined();

        expect(myOrder).toHaveProperty('orderDate');
        expect(myOrder).toHaveProperty('deliveryStatus', 'W trakcie');
        expect(myOrder).toHaveProperty('totalPrice', product.price);

        expect(myOrder.items.length).toBe(1);
        expect(myOrder.items[0]).toHaveProperty('productId', product.id);
        expect(myOrder.items[0]).toHaveProperty('price', product.price);
        expect(myOrder.items[0]).toHaveProperty('quantity', 1);
    });
});