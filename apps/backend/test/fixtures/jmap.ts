import { z } from 'zod';
const Call = z.tuple([z.string(), z.record(z.unknown()), z.string()]);
export function startJmapFixture() {
  const messages: Array<Record<string, unknown>> = [];
  let failDiscovery = false;
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request): Promise<Response> {
      const path = new URL(request.url).pathname;
      if (request.method === 'HEAD') return new Response(null, { status: 204 });
      if (!['GET', 'POST'].includes(request.method))
        return new Response(null, { status: 405 });
      if (request.method === 'GET') {
        if (path === '/jmap/session' && failDiscovery)
          return Response.json(
            { detail: 'Synthetic temporary discovery failure' },
            { status: 503 }
          );
        return Response.json({
          apiUrl: `${server.url.origin}/jmap/`,
          primaryAccounts: {
            'urn:ietf:params:jmap:mail': 'fixture-account',
            'urn:ietf:params:jmap:submission': 'fixture-account',
          },
          accounts: { 'fixture-account': {} },
        });
      }
      const parsed = z
        .object({ methodCalls: z.array(Call) })
        .safeParse(await request.json().catch(() => undefined));
      if (!parsed.success)
        return Response.json({ error: 'Invalid fixture request' }, { status: 400 });
      const body = parsed.data;
      const methodResponses = body.methodCalls.map(([method, args, id]) => {
        let result: Record<string, unknown> = { accountId: 'fixture-account' };
        if (method === 'Mailbox/get')
          result.list = [
            { id: 'drafts', role: 'drafts', name: 'Drafts' },
            { id: 'sent', role: 'sent', name: 'Sent' },
          ];
        else if (method === 'Identity/get')
          result.list = [
            {
              id: 'fixture-identity',
              email: 'noreply@test.riftbound.dev',
              name: 'The Astral Grove',
            },
          ];
        else if (method === 'Email/set') {
          const create = z.record(z.record(z.unknown())).optional().parse(args.create);
          if (create) {
            messages.push(...Object.values(create));
            result.created = Object.fromEntries(
              Object.keys(create).map((key) => [
                key,
                { id: `fixture-email-${messages.length}` },
              ])
            );
          }
          if (args.update) result.updated = {};
        } else if (method === 'EmailSubmission/set')
          result.created = { s1: { id: 'fixture-submission' } };
        return [method, result, id];
      });
      return Response.json({ methodResponses });
    },
  });
  return {
    url: server.url.origin,
    messages,
    failDiscovery() {
      failDiscovery = true;
    },
    stop() {
      server.stop(true);
    },
  };
}
