import { afterEach, describe, expect, mock, test } from 'bun:test';
import {
  isEmailConfigured,
  pickIdentity,
  pickMailbox,
  sendTransactionalEmail,
} from '../../src/lib/email.js';
import type { Env } from '../../src/env.js';

const configured = {
  STALWART_JMAP_URL: 'https://mail.solace.onl',
  STALWART_JMAP_USERNAME: 'noreply@solace.onl',
  STALWART_JMAP_PASSWORD: 'app-password',
  EMAIL_FROM: 'noreply@solace.onl',
  EMAIL_FROM_NAME: 'The Astral Grove',
} as Env;

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  mock.restore();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('isEmailConfigured', () => {
  test('requires Stalwart username, password, and from address', () => {
    const base = {} as Env;
    expect(isEmailConfigured(base)).toBe(false);
    expect(
      isEmailConfigured({ ...configured, STALWART_JMAP_PASSWORD: undefined } as Env)
    ).toBe(false);
    expect(isEmailConfigured(configured)).toBe(true);
  });
});

describe('pickMailbox / pickIdentity', () => {
  test('selects drafts and sent by role', () => {
    const mailboxes = [
      { id: 'inbox', role: 'inbox', name: 'Inbox' },
      { id: 'd1', role: 'drafts', name: 'Drafts' },
      { id: 's1', role: 'sent', name: 'Sent' },
    ];
    expect(pickMailbox(mailboxes, 'drafts')?.id).toBe('d1');
    expect(pickMailbox(mailboxes, 'sent')?.id).toBe('s1');
  });

  test('requires an identity that matches EMAIL_FROM', () => {
    const identities = [
      { id: 'id-other', email: 'hello@solace.onl' },
      { id: 'id-noreply', email: 'noreply@solace.onl' },
    ];
    expect(pickIdentity(identities, 'noreply@solace.onl')?.id).toBe('id-noreply');
    expect(pickIdentity(identities, 'missing@solace.onl')).toBeNull();
  });
});

describe('sendTransactionalEmail', () => {
  test('submits via JMAP EmailSubmission on the VPS edge', async () => {
    const fetchMock = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const auth = (init?.headers as Record<string, string>).Authorization;
      expect(auth.startsWith('Basic ')).toBe(true);

      if (url === 'https://mail.solace.onl/jmap/session') {
        return jsonResponse({
          apiUrl: 'https://mail.solace.onl/jmap/',
          primaryAccounts: {
            'urn:ietf:params:jmap:mail': 'acc1',
            'urn:ietf:params:jmap:submission': 'acc1',
          },
          accounts: { acc1: { name: 'noreply@solace.onl' } },
        });
      }

      expect(url).toBe('https://mail.solace.onl/jmap/');
      expect(init?.method).toBe('POST');
      const body = JSON.parse(String(init?.body)) as {
        methodCalls: Array<[string, Record<string, unknown>, string]>;
      };
      const methods = body.methodCalls.map((call) => call[0]);

      if (methods.includes('Mailbox/get')) {
        return jsonResponse({
          methodResponses: [
            [
              'Mailbox/get',
              {
                list: [
                  { id: 'drafts1', role: 'drafts', name: 'Drafts' },
                  { id: 'sent1', role: 'sent', name: 'Sent' },
                ],
              },
              'm',
            ],
            [
              'Identity/get',
              {
                list: [
                  { id: 'id1', email: 'noreply@solace.onl', name: 'The Astral Grove' },
                ],
              },
              'i',
            ],
          ],
        });
      }

      expect(methods).toEqual(['Email/set', 'EmailSubmission/set']);
      const emailCreate = body.methodCalls[0]?.[1]?.create as {
        draft1: {
          from: Array<{ email: string }>;
          to: Array<{ email: string }>;
          htmlBody: unknown;
        };
      };
      expect(emailCreate.draft1.from[0]?.email).toBe('noreply@solace.onl');
      expect(emailCreate.draft1.to[0]?.email).toBe('user@example.com');
      expect(emailCreate.draft1.htmlBody).toBeDefined();

      const submission = body.methodCalls[1]?.[1] as {
        create: {
          s1: {
            envelope: { mailFrom: { email: string }; rcptTo: Array<{ email: string }> };
          };
        };
        onSuccessUpdateEmail: Record<string, unknown>;
      };
      expect(submission.create.s1.envelope.mailFrom.email).toBe('noreply@solace.onl');
      expect(submission.create.s1.envelope.rcptTo[0]?.email).toBe('user@example.com');
      expect(submission.onSuccessUpdateEmail['#s1']).toBeDefined();

      return jsonResponse({
        methodResponses: [
          ['Email/set', { created: { draft1: { id: 'e1' } } }, 'c1'],
          ['EmailSubmission/set', { created: { s1: { id: 'sub1' } } }, 'c2'],
        ],
      });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    await sendTransactionalEmail(configured, {
      to: 'user@example.com',
      subject: 'Verify',
      text: 'https://rift.solace.onl/verify',
      html: '<p><a href="https://rift.solace.onl/verify">Verify email</a></p>',
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test('fails when EmailSubmission/set reports notCreated', async () => {
    let jmapPosts = 0;
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/jmap/session')) {
        return jsonResponse({
          apiUrl: 'https://mail.solace.onl/jmap/',
          primaryAccounts: { 'urn:ietf:params:jmap:mail': 'acc1' },
          accounts: { acc1: {} },
        });
      }
      if (url.endsWith('/jmap/')) {
        jmapPosts += 1;
        if (jmapPosts === 1) {
          return jsonResponse({
            methodResponses: [
              ['Mailbox/get', { list: [{ id: 'drafts1', role: 'drafts' }] }, 'm'],
              [
                'Identity/get',
                { list: [{ id: 'id1', email: 'noreply@solace.onl' }] },
                'i',
              ],
            ],
          });
        }
        return jsonResponse({
          methodResponses: [
            ['Email/set', { created: { draft1: { id: 'e1' } } }, 'c1'],
            [
              'EmailSubmission/set',
              {
                notCreated: {
                  s1: { type: 'forbidden', description: 'not allowed to send' },
                },
              },
              'c2',
            ],
          ],
        });
      }
      return new Response('missing', { status: 404 });
    }) as typeof fetch;

    await expect(
      sendTransactionalEmail(configured, {
        to: 'user@example.com',
        subject: 'Verify',
        text: 'link',
        html: '<p>link</p>',
      })
    ).rejects.toThrow(/not allowed to send/);
  });
});
