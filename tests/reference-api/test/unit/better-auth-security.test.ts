import { describe, expect, test } from 'bun:test';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { magicLink } from 'better-auth/plugins';

const baseURL = 'http://localhost:3000';
const email = 'security-test@test.riftbound.dev';

function createSecurityTestAuth() {
  let sentToken = '';
  const auth = betterAuth({
    baseURL,
    secret: 'better-auth-security-regression-test-secret',
    database: memoryAdapter({ user: [], account: [], session: [], verification: [] }),
    emailAndPassword: { enabled: true },
    socialProviders: {
      github: { clientId: 'test-client-id', clientSecret: 'test-client-secret' },
    },
    plugins: [
      magicLink({
        async sendMagicLink({ token }) {
          sentToken = token;
        },
      }),
    ],
    rateLimit: { enabled: false },
    telemetry: { enabled: false },
  });
  return { auth, getSentToken: () => sentToken };
}

describe('Better Auth verification purpose isolation (GHSA-965c-763c-88jm)', () => {
  for (const existingUser of [true, false]) {
    test(`rejects OAuth state as a magic link for ${existingUser ? 'an existing' : 'a new'} user`, async () => {
      const { auth } = createSecurityTestAuth();
      if (existingUser) {
        await auth.api.signUpEmail({
          body: { email, password: 'security-test-password', name: 'Test User' },
        });
      }
      const signIn = await auth.api.signInSocial({
        body: {
          provider: 'github',
          disableRedirect: true,
          additionalData: { email },
        },
      });
      if (!signIn.url) throw new Error('OAuth authorization URL missing');
      const state = new URL(signIn.url).searchParams.get('state');
      expect(state).toBeTruthy();

      const response = await auth.handler(
        new Request(
          `${baseURL}/api/auth/magic-link/verify?token=${state}&callbackURL=%2F`
        )
      );

      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toContain('error=INVALID_TOKEN');
      expect(response.headers.get('set-cookie') ?? '').not.toContain('session_token=');
    });
  }

  test('accepts an emailed magic link once and rejects reuse', async () => {
    const { auth, getSentToken } = createSecurityTestAuth();
    await auth.api.signInMagicLink({
      body: { email },
      headers: new Headers({ origin: baseURL }),
    });
    expect(getSentToken()).toBeTruthy();
    const url = `${baseURL}/api/auth/magic-link/verify?token=${getSentToken()}&callbackURL=%2F`;

    const response = await auth.handler(new Request(url));
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).not.toContain('error=');
    expect(response.headers.get('set-cookie')).toContain('session_token=');

    const replay = await auth.handler(new Request(url));
    expect(replay.headers.get('location')).toContain('error=INVALID_TOKEN');
    expect(replay.headers.get('set-cookie') ?? '').not.toContain('session_token=');
  });
});
