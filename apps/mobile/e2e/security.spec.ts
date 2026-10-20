import { expect, test, type BrowserContext } from '@playwright/test';
import { z } from 'zod';
import { API_URL_RUNTIME_OVERRIDE_KEY } from '../lib/api-url';
import { API_URL, WEB_ORIGIN } from './helpers/env';
import {
  installLocalApiOverride,
  signUpAndHydrateSession,
  uniqueTestUser,
} from './helpers/auth';

const mailApi = process.env.UI_E2E_AUTH_API_URL;
const fixture = process.env.UI_E2E_FIXTURE_URL;
const releasePage = process.env.UI_E2E_RELEASE_URL;
const Messages = z.array(
  z.object({
    subject: z.string(),
    bodyValues: z.object({ text: z.object({ value: z.string() }) }),
  })
);
const Signup = z.object({ user: z.object({ id: z.string(), email: z.string() }) });
test.skip(
  !mailApi || !fixture,
  'Run through scripts/security-ui.test.ts with isolated mail and Postgres fixtures'
);
test.use({
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
});

async function mailOverride(context: BrowserContext) {
  await context.addInitScript(
    ({ key, url }) => {
      Object.defineProperty(globalThis, key, { value: url, configurable: true });
    },
    { key: API_URL_RUNTIME_OVERRIDE_KEY, url: mailApi! }
  );
}
async function post(origin: string, path: string, body: unknown, cookie?: string) {
  return fetch(origin + path, {
    method: 'POST',
    headers: {
      origin: WEB_ORIGIN,
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}
async function latestMail(email: string, subject = 'Verify your Astral Grove email') {
  let text: string | undefined;
  await expect
    .poll(
      async () => {
        const response = await fetch(fixture + '?email=' + encodeURIComponent(email));
        expect(response.ok).toBe(true);
        const messages = Messages.parse(await response.json());
        text = messages.findLast((message) => message.subject === subject)?.bodyValues
          .text.value;
        return text;
      },
      { message: `Wait for "${subject}" delivery`, timeout: 10_000 }
    )
    .toBeTruthy();
  expect(text).not.toContain('astral-grove://');
  return text!;
}

test('signup verifies email then signs in with the entered password', async ({
  context,
  page,
}) => {
  await mailOverride(context);
  const user = uniqueTestUser('security-ui-signup');
  await page.goto('/search');
  await page.getByRole('tab', { name: 'Sign up', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByLabel('Verification code', { exact: true })).toBeVisible();
  const otp = (await latestMail(user.email)).match(/Verification code: (\d{6})/)?.[1];
  expect(otp).toBeTruthy();
  await page.getByLabel('Verification code', { exact: true }).fill(otp!);
  await page.getByRole('button', { name: 'Verify and continue', exact: true }).click();
  await expect(
    page.getByPlaceholder('Search cards, artists, tags, or set numbers')
  ).toBeVisible();
  const session = await context.request.get(mailApi + '/api/auth/get-session');
  expect(Signup.parse(await session.json()).user.email).toBe(user.email);
});

test('verification links require a click and never replace another signed-in account', async ({
  context,
  page,
}) => {
  const victim = await signUpAndHydrateSession(
    context,
    uniqueTestUser('security-ui-victim')
  );
  const attacker = uniqueTestUser('security-ui-link');
  expect((await post(mailApi!, '/api/auth/sign-up/email', attacker)).status).toBe(200);
  const link = (await latestMail(attacker.email)).match(
    /Or open this link: (\S+)/
  )?.[1];
  expect(link).toBeTruthy();
  expect(new URL(link!).searchParams.get('token')).toHaveLength(43);
  await mailOverride(context);
  const writes: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST') writes.push(new URL(request.url()).pathname);
  });
  const emailed = new URL(link!);
  await page.goto(emailed.pathname + emailed.search);
  await expect(page.getByRole('button', { name: 'Verify email' })).toBeEnabled();
  expect(writes).not.toContain('/api/auth/email-otp/verify-email');
  await page.getByRole('button', { name: 'Verify email' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Sign out before verifying another account'
  );
  const session = await context.request.get(mailApi + '/api/auth/get-session');
  expect(Signup.parse(await session.json()).user.email).toBe(victim.email);
  expect(writes.filter((path) => path.startsWith('/api/v1/collection'))).toEqual([]);
  expect(new URL(page.url()).origin).toBe(WEB_ORIGIN);
});

test('password reset stays in the browser and requires normal sign-in afterwards', async ({
  context,
  page,
}) => {
  const user = uniqueTestUser('security-ui-reset');
  expect((await post(mailApi!, '/api/auth/sign-up/email', user)).status).toBe(200);
  const otp = (await latestMail(user.email)).match(/Verification code: (\d{6})/)?.[1];
  expect(otp).toBeTruthy();
  expect(
    (
      await post(mailApi!, '/api/auth/email-otp/verify-email', {
        email: user.email,
        otp,
      })
    ).status
  ).toBe(200);
  expect(
    (
      await post(mailApi!, '/api/auth/request-password-reset', {
        email: user.email,
        redirectTo: WEB_ORIGIN + '/reset-password',
      })
    ).status
  ).toBe(200);
  const token = (
    await latestMail(user.email, 'Reset your Astral Grove password')
  ).match(/[?&]token=([^&\s]+)/)?.[1];
  expect(token).toBeTruthy();
  await mailOverride(context);
  const signIns: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/auth/sign-in/email')
      signIns.push(request.url());
  });
  await page.goto(
    `/reset-password?token=${token}&email=${encodeURIComponent('untrusted-display@test.riftbound.dev')}`
  );
  await page.getByLabel('New password', { exact: true }).fill('UpdatedPassword1234');
  await page
    .getByLabel('Confirm password', { exact: true })
    .fill('UpdatedPassword1234');
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await expect(page.getByText('Password updated', { exact: true })).toBeVisible();
  expect(signIns).toEqual([]);
  expect(
    await (await context.request.get(mailApi + '/api/auth/get-session')).json()
  ).toBeNull();
  expect(
    (
      await post(mailApi!, '/api/auth/sign-in/email', {
        email: user.email,
        password: 'UpdatedPassword1234',
      })
    ).status
  ).toBe(200);
  expect(new URL(page.url()).origin).toBe(WEB_ORIGIN);
});

test('a mobile-browser invitation stays on the web and can still join a collection', async ({
  context,
  page,
}) => {
  await installLocalApiOverride(context);
  await signUpAndHydrateSession(context, uniqueTestUser('security-ui-invitee'));
  const owner = await post(
    API_URL,
    '/api/auth/sign-up/email',
    uniqueTestUser('security-ui-inviter')
  );
  expect(owner.status).toBe(200);
  const cookie = owner.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
  const invite = z
    .object({ data: z.object({ token: z.string() }) })
    .parse(
      await (await post(API_URL, '/api/v1/collection/share/invite', {}, cookie)).json()
    );
  await page.goto('/invite/' + invite.data.token);
  await expect(
    page.getByRole('button', { name: 'Use their collection' })
  ).toBeVisible();
  expect(new URL(page.url()).origin).toBe(WEB_ORIGIN);
  expect(new URL(page.url()).pathname).toBe('/collection/invite/' + invite.data.token);
  page.once('dialog', (dialog) => dialog.accept());
  const accepted = page.waitForResponse(
    (response) =>
      response.url().endsWith('/accept') && response.request().method() === 'POST'
  );
  await page.getByRole('button', { name: 'Use their collection' }).click();
  expect((await accepted).status()).toBe(200);
  await expect(page).toHaveURL(/\/collection$/);
});

test('release HTML blocks scripts while its Android download still works', async ({
  page,
}) => {
  test.skip(!releasePage, 'Requires the local release storage fixture');
  const response = await page.goto(releasePage!);
  expect(response?.status()).toBe(200);
  expect(response?.headers()['content-security-policy']).toContain('sandbox');
  await expect(page.getByRole('heading', { name: 'Fixture install' })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.dataset.executed)
  ).toBeUndefined();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download for Android' }).click();
  const download = await downloaded;
  expect(await download.failure()).toBeNull();
  expect(download.suggestedFilename()).toBe('astral-grove-preview.apk');
  const chunks: Buffer[] = [];
  for await (const chunk of await download.createReadStream())
    chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString()).toBe('synthetic-browser-apk');
});
