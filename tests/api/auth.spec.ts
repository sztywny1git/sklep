import { test, expect } from '@playwright/test';

// Funkcja pomocnicza do tworzenia usera i logowania w testach wymagających autoryzacji
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
    return { email, password, token: body.token, userId: body.userId || body.id };
}

test('TC01: Poprawna rejestracja nowego użytkownika', async ({ request }) => {
    const response = await request.post('/api/users/register', {
        data: { username: "NowyUser", email: `user_${Date.now()}@example.com`, password: "Password123!" }
    });
    expect(response.status()).toBe(200);
});

test('TC02: Rejestracja z istniejącym e-mailem', async ({ request }) => {
    const email = `duplicate_${Date.now()}@example.com`;
    const payload = { username: "User1", email, password: "Password123!" };

    await request.post('/api/users/register', { data: payload });
    const response = await request.post('/api/users/register', { data: payload });

    expect(response.status()).not.toBe(200);
});

test('TC04: Logowanie poprawnym emailem i hasłem', async ({ request }) => {
    const { token } = await createAndLoginUser(request);
    expect(token).toBeTruthy();
});

test('TC05: Logowanie z błędnym hasłem', async ({ request }) => {
    const { email } = await createAndLoginUser(request);

    const response = await request.post('/api/users/login', {
        data: { email, password: "WrongPassword!" }
    });
    expect(response.status()).toBe(401);
});

test('TC07: Pobranie listy kategorii', async ({ request }) => {
    const response = await request.get('/api/categories');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBeTruthy();
});

test('TC11: Pobranie istniejącego produktu', async ({ request }) => {
    const listRes = await request.get('/api/products');
    const list = await listRes.json();
    const firstProductId = list[0].id;

    const response = await request.get(`/api/products/${firstProductId}`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.id).toBe(firstProductId);
});

test('TC12: Pobranie nieistniejącego produktu', async ({ request }) => {
    const response = await request.get('/api/products/9999999');
    expect(response.status()).toBe(404);
});

test('TC16: Dodanie do koszyka istniejącego produktu', async ({ request }) => {
    const { token, userId } = await createAndLoginUser(request);

    const listRes = await request.get('/api/products');
    const list = await listRes.json();
    const productId = list[0].id;

    const response = await request.post(`/api/users/${userId}/addToCart`, {
        headers: { 'Authorization': `Bearer ${token}` },
        data: { productId, quantity: 1 }
    });

    expect(response.status()).toBe(200);
});

test('TC18: Dodanie produktu z ilością większą niż stan magazynowy', async ({ request }) => {
    const { token, userId } = await createAndLoginUser(request);

    const listRes = await request.get('/api/products');
    const list = await listRes.json();
    const productId = list[0].id;

    const response = await request.post(`/api/users/${userId}/addToCart`, {
        headers: { 'Authorization': `Bearer ${token}` },
        data: { productId, quantity: 99999 }
    });

    expect(response.status()).toBe(400);
});

test('TC24: Usunięcie istniejącej pozycji z koszyka', async ({ request }) => {
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
});

test('TC27: Złożenie zamówienia dla poprawnego koszyka', async ({ request }) => {
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
});

test('TC31: Pobranie historii zamówień użytkownika', async ({ request }) => {
    const { token, userId } = await createAndLoginUser(request);

    const orderRes = await request.get(`/api/orders/${userId}/orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    expect(orderRes.status()).toBe(200);
    const body = await orderRes.json();
    expect(Array.isArray(body)).toBeTruthy();
});