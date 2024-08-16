import { type APIRequestContext, expect, test } from '@playwright/test';

export async function loginViaApi (request: APIRequestContext) {
  await test.step('Login via API', async () => {
    const usp = new URLSearchParams();
    usp.set('username', process.env.USERNAME);
    usp.set('password', process.env.PASSWORD);

    const response = await request.post('/api/v1/auth/login', {
      data: usp.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    expect(response.ok()).toBe(true);
  });
}
