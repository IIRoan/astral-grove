import type { Env } from '../env.js';

export type TransactionalEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export const DEFAULT_STALWART_JMAP_URL = 'https://mail.solace.onl';

const JMAP_USING = [
  'urn:ietf:params:jmap:core',
  'urn:ietf:params:jmap:mail',
  'urn:ietf:params:jmap:submission',
] as const;

const REQUEST_TIMEOUT_MS = 15_000;

type JmapMethodCall = [string, Record<string, unknown>, string];

type JmapEnvelope = {
  methodResponses?: Array<[string, Record<string, unknown>, string]>;
};

type JmapMethodError = {
  type?: string;
  description?: string;
  properties?: string[];
};

type JmapSession = {
  apiUrl?: string;
  primaryAccounts?: Record<string, string>;
  accounts?: Record<string, unknown>;
};

export type JmapMailbox = {
  id: string;
  role?: string | null;
  name?: string;
};

export type JmapIdentity = {
  id: string;
  email?: string;
  name?: string | null;
};

type EmailConfig = {
  baseUrl: string;
  username: string;
  password: string;
  from: string;
  fromName: string;
};

export function isEmailConfigured(env: Env): boolean {
  return Boolean(
    env.STALWART_JMAP_USERNAME && env.STALWART_JMAP_PASSWORD && env.EMAIL_FROM
  );
}

export function jmapBaseUrl(env: Env): string {
  return (env.STALWART_JMAP_URL ?? DEFAULT_STALWART_JMAP_URL).replace(/\/+$/, '');
}

export function pickMailbox(
  mailboxes: JmapMailbox[],
  role: 'drafts' | 'sent'
): JmapMailbox | null {
  const wanted = role.toLowerCase();
  return (
    mailboxes.find((mailbox) => mailbox.role?.toLowerCase() === wanted) ??
    mailboxes.find((mailbox) => mailbox.name?.toLowerCase() === wanted) ??
    null
  );
}

export function pickIdentity(
  identities: JmapIdentity[],
  fromEmail: string
): JmapIdentity | null {
  const needle = fromEmail.trim().toLowerCase();
  return (
    identities.find((identity) => identity.email?.trim().toLowerCase() === needle) ??
    null
  );
}

function requireConfig(env: Env): EmailConfig {
  if (
    !isEmailConfigured(env) ||
    !env.STALWART_JMAP_USERNAME ||
    !env.STALWART_JMAP_PASSWORD ||
    !env.EMAIL_FROM
  ) {
    throw new Error('Email sending is not configured');
  }
  return {
    baseUrl: jmapBaseUrl(env),
    username: env.STALWART_JMAP_USERNAME,
    password: env.STALWART_JMAP_PASSWORD,
    from: env.EMAIL_FROM,
    fromName: env.EMAIL_FROM_NAME ?? 'The Astral Grove',
  };
}

function basicAuthHeader(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, 'utf8').toString('base64')}`;
}

function rewriteToPublicOrigin(url: string | undefined, publicBase: string): string {
  const fallback = `${publicBase}/jmap/`;
  if (!url) return fallback;
  try {
    const parsed = new URL(url);
    const base = new URL(publicBase);
    parsed.protocol = base.protocol;
    parsed.host = base.host;
    return parsed.toString();
  } catch {
    return fallback;
  }
}

function formatJmapError(methodName: string, error: JmapMethodError): string {
  const propsHint = error.properties?.length
    ? ` (properties: ${error.properties.join(', ')})`
    : '';
  const typeHint = error.type ? ` [${error.type}]` : '';
  return `${error.description || error.type || `Failed during ${methodName}`}${typeHint}${propsHint}`;
}

function firstPatchError(
  patch: Record<string, JmapMethodError> | undefined
): JmapMethodError | null {
  if (!patch) return null;
  const first = Object.values(patch)[0];
  return first ?? null;
}

function assertJmapSuccess(envelope: JmapEnvelope, context: string): void {
  const responses = envelope.methodResponses ?? [];
  if (responses.length === 0) {
    throw new Error(`${context}: empty JMAP response`);
  }

  for (const [methodName, result] of responses) {
    if (methodName === 'error' || methodName.endsWith('/error')) {
      throw new Error(
        formatJmapError(methodName === 'error' ? context : methodName, result)
      );
    }
    const patchError =
      firstPatchError(
        result.notCreated as Record<string, JmapMethodError> | undefined
      ) ??
      firstPatchError(
        result.notUpdated as Record<string, JmapMethodError> | undefined
      ) ??
      firstPatchError(
        result.notDestroyed as Record<string, JmapMethodError> | undefined
      );
    if (patchError) {
      throw new Error(formatJmapError(methodName, patchError));
    }
  }
}

async function readHttpError(response: Response): Promise<string> {
  const raw = await response.text();
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw) as {
      detail?: string;
      message?: string;
      error?: string;
    };
    return parsed.detail || parsed.message || parsed.error || raw.slice(0, 200);
  } catch {
    return raw.slice(0, 200);
  }
}

async function jmapFetch(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

async function discoverSession(
  config: EmailConfig,
  authorization: string
): Promise<{
  apiUrl: string;
  mailAccountId: string;
  submissionAccountId: string;
}> {
  const urls = [`${config.baseUrl}/jmap/session`, `${config.baseUrl}/.well-known/jmap`];
  let lastStatus = 0;
  let lastDetail = '';

  for (const url of urls) {
    const response = await jmapFetch(url, {
      method: 'GET',
      headers: { Authorization: authorization, Accept: 'application/json' },
      redirect: 'follow',
    });
    if (response.status === 401) {
      throw new Error('Stalwart JMAP authentication failed');
    }
    if (!response.ok) {
      lastStatus = response.status;
      lastDetail = await readHttpError(response);
      continue;
    }
    const session = (await response.json()) as JmapSession;
    const mailAccountId =
      primaryAccountId(session, 'urn:ietf:params:jmap:mail') ??
      primaryAccountId(session, 'urn:stalwart:jmap') ??
      Object.keys(session.accounts ?? {})[0];
    if (!mailAccountId) {
      throw new Error('Stalwart JMAP session did not include a mail account');
    }
    return {
      apiUrl: rewriteToPublicOrigin(session.apiUrl, config.baseUrl),
      mailAccountId,
      submissionAccountId:
        primaryAccountId(session, 'urn:ietf:params:jmap:submission') ?? mailAccountId,
    };
  }

  throw new Error(
    `Stalwart JMAP session failed (${String(lastStatus)})${lastDetail ? `: ${lastDetail}` : ''}`
  );
}

async function jmapCall(
  apiUrl: string,
  authorization: string,
  methodCalls: JmapMethodCall[]
): Promise<JmapEnvelope> {
  const response = await jmapFetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ using: [...JMAP_USING], methodCalls }),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(
      `Stalwart JMAP request failed (${String(response.status)})${raw ? `: ${raw.slice(0, 200)}` : ''}`
    );
  }

  try {
    return JSON.parse(raw) as JmapEnvelope;
  } catch {
    throw new Error('Stalwart JMAP returned a non-JSON response');
  }
}

function methodResult<T>(envelope: JmapEnvelope, method: string): T {
  const match = envelope.methodResponses?.find((entry) => entry[0] === method);
  if (!match) {
    throw new Error(`Expected ${method} in JMAP response`);
  }
  return match[1] as T;
}

function primaryAccountId(
  sessionAccounts: JmapSession,
  capability: string
): string | undefined {
  return sessionAccounts.primaryAccounts?.[capability];
}

async function loadSendContext(
  apiUrl: string,
  authorization: string,
  mailAccountId: string,
  fromEmail: string
): Promise<{ draftsId: string; sentId: string | null; identityId: string }> {
  const envelope = await jmapCall(apiUrl, authorization, [
    [
      'Mailbox/get',
      { accountId: mailAccountId, ids: null, properties: ['id', 'role', 'name'] },
      'm',
    ],
    ['Identity/get', { accountId: mailAccountId }, 'i'],
  ]);
  assertJmapSuccess(envelope, 'Stalwart mailbox lookup');

  const mailboxes =
    methodResult<{ list?: JmapMailbox[] }>(envelope, 'Mailbox/get').list ?? [];
  const identities =
    methodResult<{ list?: JmapIdentity[] }>(envelope, 'Identity/get').list ?? [];
  const drafts = pickMailbox(mailboxes, 'drafts');
  if (!drafts) {
    throw new Error('Stalwart mailbox has no Drafts folder');
  }
  const identity = pickIdentity(identities, fromEmail);
  if (!identity) {
    throw new Error(
      `Stalwart identity ${fromEmail} was not found; create it on the sending mailbox`
    );
  }

  return {
    draftsId: drafts.id,
    sentId: pickMailbox(mailboxes, 'sent')?.id ?? null,
    identityId: identity.id,
  };
}

function buildSendCalls(input: {
  mailAccountId: string;
  submissionAccountId: string;
  draftsId: string;
  sentId: string | null;
  identityId: string;
  from: string;
  fromName: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}): JmapMethodCall[] {
  const submissionCreate: Record<string, unknown> = {
    emailId: '#draft1',
    identityId: input.identityId,
    envelope: {
      mailFrom: { email: input.from },
      rcptTo: [{ email: input.to }],
    },
  };

  const submission: Record<string, unknown> = {
    accountId: input.submissionAccountId,
    create: { s1: submissionCreate },
  };
  if (input.sentId) {
    submission.onSuccessUpdateEmail = {
      '#s1': {
        [`mailboxIds/${input.sentId}`]: true,
        [`mailboxIds/${input.draftsId}`]: null,
        'keywords/$draft': null,
      },
    };
  }

  return [
    [
      'Email/set',
      {
        accountId: input.mailAccountId,
        create: {
          draft1: {
            mailboxIds: { [input.draftsId]: true },
            keywords: { $seen: true, $draft: true },
            from: [{ name: input.fromName, email: input.from }],
            to: [{ email: input.to }],
            subject: input.subject,
            bodyValues: {
              text: { value: input.text },
              html: { value: input.html },
            },
            textBody: [{ partId: 'text', type: 'text/plain' }],
            htmlBody: [{ partId: 'html', type: 'text/html' }],
          },
        },
      },
      'c1',
    ],
    ['EmailSubmission/set', submission, 'c2'],
  ];
}

export async function sendTransactionalEmail(
  env: Env,
  message: TransactionalEmail
): Promise<void> {
  const config = requireConfig(env);
  const authorization = basicAuthHeader(config.username, config.password);
  const session = await discoverSession(config, authorization);
  const context = await loadSendContext(
    session.apiUrl,
    authorization,
    session.mailAccountId,
    config.from
  );

  const envelope = await jmapCall(
    session.apiUrl,
    authorization,
    buildSendCalls({
      mailAccountId: session.mailAccountId,
      submissionAccountId: session.submissionAccountId,
      draftsId: context.draftsId,
      sentId: context.sentId,
      identityId: context.identityId,
      from: config.from,
      fromName: config.fromName,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    })
  );
  assertJmapSuccess(envelope, 'Stalwart email send');

  const submission = methodResult<{ created?: Record<string, { id?: string }> }>(
    envelope,
    'EmailSubmission/set'
  );
  if (!submission.created?.s1?.id) {
    throw new Error('Stalwart did not queue the message for delivery');
  }
}
