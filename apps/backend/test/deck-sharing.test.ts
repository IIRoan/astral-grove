import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import { DeckDetailResponse, DeckListResponse } from '@riftbound/contracts';
import { createHarness, json, runCommand } from './support';

setDefaultTimeout(60_000);
const harness = createHarness();
afterAll(() => harness.stopServer());

test('owners can enable and revoke anonymous read-only links without exposing private deck history', async () => {
  const app = await harness.startServer();
  const owner = await harness.signup(app, 'share-owner');
  const other = await harness.signup(app, 'share-other');
  const payload = {
    id: `deck_${crypto.randomUUID()}`,
    name: 'Shared deck',
    format: 'pre-rift',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    legend: null,
    champion: null,
    mainDeck: [],
    runes: [],
    battlefields: [],
    sideboard: [],
  };
  const save = (body: unknown, cookie = owner.cookie) =>
    app.fetch(`/api/v1/decks/${payload.id}`, { ...json(body, cookie), method: 'PUT' });
  const share = (enabled: unknown, cookie = owner.cookie) =>
    app.fetch(`/api/v1/decks/${payload.id}/sharing`, {
      ...json({ enabled }, cookie),
      method: 'PATCH',
    });
  const parse = async (response: Response) => {
    expect(response.status).toBe(200);
    return DeckDetailResponse.parse(await response.json()).data;
  };
  const deck = await parse(await save(payload));
  expect(deck.shareToken ?? null).toBeNull();
  expect((await share(true, '')).status).toBe(401);
  expect((await share(true, other.cookie)).status).toBe(404);
  expect((await share('true')).status).toBe(422);
  expect((await share(null)).status).toBe(422);
  expect(
    (await app.fetch(`/api/v1/decks/${deck.id}`, { headers: { cookie: other.cookie } }))
      .status
  ).toBe(404);
  expect((await app.fetch(`/api/v1/shared/decks/${deck.id}`)).status).toBe(404);

  const enabled = await parse(await share(true));
  const token = enabled.shareToken;
  if (!token) throw new Error('Link access did not create a token');
  expect(token).toMatch(/^dshare_[a-f0-9]{32}$/);
  expect((await parse(await share(true))).shareToken).toBe(token);
  const path = `/api/v1/shared/decks/${token}`;
  const response = await app.fetch(path);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const publicDeck = await parse(response);
  expect(publicDeck).toMatchObject({
    id: token,
    name: deck.name,
    readOnly: true,
    shareToken: token,
  });
  for (const key of [
    'versions',
    'versionId',
    'versionName',
    'upstreamId',
    'importedFromId',
    'userId',
  ])
    expect(publicDeck).not.toHaveProperty(key);
  expect(
    (await app.fetch(path, { ...json(payload, other.cookie), method: 'PUT' })).status
  ).toBe(405);
  const list = DeckListResponse.parse(
    await (
      await app.fetch('/api/v1/decks?source=owned', {
        headers: { cookie: owner.cookie },
      })
    ).json()
  );
  expect(list.data.find((item) => item.id === deck.id)?.shareToken).toBe(token);

  const branch = await parse(
    await app.fetch(
      `/api/v1/decks/${deck.id}/versions`,
      json({ name: 'Private version name' }, owner.cookie)
    )
  );
  await parse(await save({ ...branch, format: 'constructed' }));
  expect((await parse(await app.fetch(path))).format).toBe('constructed');
  await parse(
    await app.fetch(
      `/api/v1/decks/${deck.id}/versions/${deck.versionId}/activate`,
      json({}, owner.cookie)
    )
  );
  expect((await parse(await app.fetch(path))).format).toBe('pre-rift');
  expect(
    (
      await parse(
        await app.fetch(`/api/v1/decks/${deck.id}`, {
          headers: { cookie: owner.cookie },
        })
      )
    ).shareToken
  ).toBe(token);

  expect((await parse(await share(false))).shareToken ?? null).toBeNull();
  await parse(await save({ ...deck, shareToken: token }));
  expect((await app.fetch(path)).status).toBe(404);
  const renewed = await parse(await share(true));
  expect(renewed.shareToken).not.toBe(token);
  expect((await app.fetch(path)).status).toBe(404);
  const renewedPath = `/api/v1/shared/decks/${renewed.shareToken}`;
  expect((await app.fetch(renewedPath)).status).toBe(200);
  expect((await runCommand(app.config, ['migrate'])).exitCode).toBe(0);
  const restarted = await harness.startServer();
  expect((await restarted.fetch(renewedPath)).status).toBe(200);

  await parse(await save(payload, other.cookie));
  const otherDeck = await parse(await share(true, other.cookie));
  expect(otherDeck.shareToken).not.toBe(renewed.shareToken);
  expect(
    (
      await app.fetch(`/api/v1/decks/${deck.id}`, {
        method: 'DELETE',
        headers: { cookie: owner.cookie },
      })
    ).status
  ).toBe(200);
  expect((await app.fetch(renewedPath)).status).toBe(404);
  expect((await app.fetch(`/api/v1/shared/decks/${otherDeck.shareToken}`)).status).toBe(
    200
  );
});
