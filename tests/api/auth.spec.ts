import { test, expect } from '@playwright/test';

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
    // Wysyła żądanie POST do rejestracji i sprawdza, czy API zwraca kod sukcesu (200).
    test('T01: Poprawna rejestracja nowego użytkownika', async ({ request }) => {
        const response = await request.post('/api/users/register', {
            data: { username: "NowyUser", email: `user_${Date.now()}@example.com`, password: "Password123!" }
        });

        expect(response.status()).toBe(200);
    });


    // Weryfikuje, czy API zwraca 404 w przypadku próby odczytu nieistniejącego ID produktu.
    test('T02: Pobranie nieistniejącego produktu', async ({ request }) => {
        const notFoundRes = await request.get('/api/products/9999999');
        expect(notFoundRes.status()).toBe(404);
    });

    // Testuje przepływ dodawania produktu do koszyka (używając tokena JWT) i sprawdza czy produkt został poprawnie zapisany.
    test('T03: Dodanie produktu do koszyka i weryfikacja stanu koszyka', async ({ request }) => {
        const { token, userId } = await createAndLoginUser(request);
        const listRes = await request.get('/api/products');
        const productId = (await listRes.json())[0].id;

        const addResponse = await request.post(`/api/users/${userId}/addToCart`, {
            headers: { 'Authorization': `Bearer ${token}` },
            data: { productId, quantity: 1 }
        });
        expect(addResponse.status()).toBe(200);

        const cartRes = await request.get(`/api/users/${userId}/cart`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const cartBody = await cartRes.json();
        expect(cartBody.cartItems.length).toBeGreaterThan(0);
        expect(cartBody.cartItems[0].productId).toBe(productId);
    });

    // Testy 4-6 - Martyna
    // Próbuje zalogować się z poprawnym emailem, ale błędnym hasłem, oczekując odmowy dostępu (401).
    test('T04: Logowanie z błędnym hasłem', async ({ request }) => {
        const { email } = await createAndLoginUser(request);

        const response = await request.post('/api/users/login', {
            data: { email, password: "WrongPassword!" }
        });

        expect(response.status()).toBe(401);
    });

    // Sprawdza walidację unikalności emaila przy rejestracji (powinna zwrócić 400).
    test('T05: Rejestracja z istniejącym e-mailem', async ({ request }) => {
        const email = `duplicate_${Date.now()}@example.com`;
        const payload = { username: "User1", email, password: "Password123!" };

        await request.post('/api/users/register', { data: payload });
        const response = await request.post('/api/users/register', { data: payload });

        expect(response.status()).toBe(400);
    });

    // Testuje całą ścieżkę zamówienia: dodanie do koszyka -> złożenie zamówienia -> weryfikacja czy koszyk został wyczyszczony.
    test('T06: Złożenie zamówienia dla poprawnego koszyka', async ({ request }) => {
        const { token, userId } = await createAndLoginUser(request);
        const listRes = await request.get('/api/products');
        const productId = (await listRes.json())[0].id;

        await request.post(`/api/users/${userId}/addToCart`, {
            headers: { 'Authorization': `Bearer ${token}` },
            data: { productId, quantity: 1 }
        });

        const orderRes = await request.post(`/api/orders/${userId}/placeorder`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        expect(orderRes.status()).toBe(200);

        const orderBody = await orderRes.json();
        expect(orderBody).toHaveProperty("orderId");

        const cartRes = await request.get(`/api/users/${userId}/cart`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const cartBody = await cartRes.json();
        expect(cartBody.cartItems.length).toBe(0);
    });


    // Testy 7-9 - Łukasz
    // Potwierdza, że logowanie poprawnymi danymi zwraca poprawny token autoryzacyjny i userId.
    test('T07: Logowanie poprawnym emailem i hasłem', async ({ request }) => {
        const { token, userId } = await createAndLoginUser(request);

        expect(token).toBeTruthy();
        expect(typeof token).toBe('string');
        expect(userId).toBeGreaterThan(0);
    });

    // Weryfikuje pobieranie szczegółowych danych produktu po jego ID.
    test('T08: Pobranie istniejącego produktu', async ({ request }) => {
        const listRes = await request.get('/api/products');
        const list = await listRes.json();

        if (list.length > 0) {
            const firstProductId = list[0].id;
            const response = await request.get(`/api/products/${firstProductId}`);
            expect(response.status()).toBe(200);

            const body = await response.json();
            expect(body.id).toBe(firstProductId);
            expect(body.price).toBeGreaterThanOrEqual(0);
        }
    });

    // Testuje usuwanie produktu z koszyka i weryfikuje czy po operacji koszyk użytkownika jest pusty.
    test('T09: Usunięcie istniejącej pozycji z koszyka i weryfikacja', async ({ request }) => {
        const { token, userId } = await createAndLoginUser(request);
        const listRes = await request.get('/api/products');
        const productId = (await listRes.json())[0].id;

        await request.post(`/api/users/${userId}/addToCart`, {
            headers: { 'Authorization': `Bearer ${token}` },
            data: { productId, quantity: 1 }
        });

        const delResponse = await request.delete(`/api/users/${userId}/cart/${productId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        expect(delResponse.status()).toBe(200);

        const cartRes = await request.get(`/api/users/${userId}/cart`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const cartBody = await cartRes.json();
        expect(cartBody.cartItems.length).toBe(0);
    });

    // Testy 10-12 - Paweł
    // Sprawdza, czy endpoint kategorii poprawnie zwraca tablicę dostępnych kategorii.
    test('T10: Pobranie listy kategorii', async ({ request }) => {
        const response = await request.get('/api/categories');
        expect(response.status()).toBe(200);

        const body = await response.json();
        expect(Array.isArray(body)).toBeTruthy();
        if (body.length > 0) {
            expect(body[0]).toHaveProperty('id');
            expect(body[0]).toHaveProperty('name');
        }
    });

    // Testuje walidację stanów magazynowych – próba dodania do koszyka zbyt dużej ilości produktu.
    test('T11: Dodanie produktu z ilością większą niż stan magazynowy', async ({ request }) => {
        const { token, userId } = await createAndLoginUser(request);
        const listRes = await request.get('/api/products');
        const productId = (await listRes.json())[0].id;

        const response = await request.post(`/api/users/${userId}/addToCart`, {
            headers: { 'Authorization': `Bearer ${token}` },
            data: { productId, quantity: 99999 }
        });

        expect(response.status()).toBe(400);
    });

    // Weryfikuje czy po złożeniu zamówienia, użytkownik może pobrać poprawną historię swoich zakupów.
    test('T12: Pobranie historii zamówień użytkownika', async ({ request }) => {
        const { token, userId } = await createAndLoginUser(request);
        const listRes = await request.get('/api/products');
        const productId = (await listRes.json())[0].id;

        await request.post(`/api/users/${userId}/addToCart`, {
            headers: { 'Authorization': `Bearer ${token}` },
            data: { productId, quantity: 1 }
        });
        await request.post(`/api/orders/${userId}/placeorder`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const historyRes = await request.get(`/api/orders/${userId}/orders`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        expect(historyRes.status()).toBe(200);
        const historyBody = await historyRes.json();

        expect(Array.isArray(historyBody)).toBeTruthy();
        expect(historyBody.length).toBeGreaterThan(0);
        expect(historyBody[0]).toHaveProperty('totalPrice');
        expect(historyBody[0]).toHaveProperty('items');
    });
});