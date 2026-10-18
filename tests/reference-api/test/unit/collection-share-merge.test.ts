import { describe, expect, test } from 'bun:test';
import {
  CollectionShareAcceptMode,
  CollectionShareAcceptRequest,
  CollectionShareInviteCreateResponse,
  CollectionShareInvitePreview,
  CollectionSharePendingInvite,
  CollectionShareStatus,
} from '@riftbound/contracts';
import {
  buildCollectionInviteDeepLink,
  buildCollectionInviteUrl,
  mergeCollectionStacks,
} from '../../src/services/collection-share-service.js';

const APP_BASE = 'https://rift.solace.onl';

describe('buildCollectionInviteUrl', () => {
  test('builds HTTPS linking page URL with token', () => {
    expect(buildCollectionInviteUrl('abc123token', APP_BASE)).toBe(
      'https://rift.solace.onl/invite/abc123token'
    );
  });

  test('strips trailing slash from public app URL', () => {
    expect(buildCollectionInviteUrl('tok', 'https://rift.solace.onl/')).toBe(
      'https://rift.solace.onl/invite/tok'
    );
  });

  test('deep link remains astral-grove scheme for native handoff', () => {
    const token = 'deadbeefcafebabe0123456789abcdefdeadbeefcafebabe0123456789abcdef';
    expect(buildCollectionInviteDeepLink(token)).toBe(
      `astral-grove://collection/invite/${token}`
    );
  });
});

describe('mergeCollectionStacks', () => {
  test('sums quantities on matching variant/condition/language', () => {
    const merged = mergeCollectionStacks(
      [
        {
          variantNumber: 'OGN-001',
          condition: 'near_mint',
          language: 'en',
          quantity: 2,
        },
        {
          variantNumber: 'OGN-002',
          condition: 'near_mint',
          language: 'en',
          quantity: 1,
        },
      ],
      [
        {
          variantNumber: 'OGN-001',
          condition: 'near_mint',
          language: 'en',
          quantity: 3,
        },
        {
          variantNumber: 'OGN-003',
          condition: 'near_mint',
          language: 'en',
          quantity: 5,
        },
      ]
    );

    expect(merged).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          variantNumber: 'OGN-001',
          condition: 'near_mint',
          language: 'en',
          quantity: 5,
        }),
        expect.objectContaining({
          variantNumber: 'OGN-002',
          quantity: 1,
        }),
        expect.objectContaining({
          variantNumber: 'OGN-003',
          quantity: 5,
        }),
      ])
    );
    expect(merged).toHaveLength(3);
  });

  test('keeps different condition or language stacks separate', () => {
    const merged = mergeCollectionStacks(
      [
        {
          variantNumber: 'OGN-001',
          condition: 'near_mint',
          language: 'en',
          quantity: 1,
        },
      ],
      [
        {
          variantNumber: 'OGN-001',
          condition: 'lightly_played',
          language: 'en',
          quantity: 2,
        },
        {
          variantNumber: 'OGN-001',
          condition: 'near_mint',
          language: 'de',
          quantity: 3,
        },
      ]
    );

    expect(merged).toHaveLength(3);
    expect(
      merged.find((s) => s.condition === 'near_mint' && s.language === 'en')?.quantity
    ).toBe(1);
    expect(
      merged.find((s) => s.condition === 'lightly_played' && s.language === 'en')
        ?.quantity
    ).toBe(2);
    expect(
      merged.find((s) => s.condition === 'near_mint' && s.language === 'de')?.quantity
    ).toBe(3);
  });

  test('returns source stacks when target is empty', () => {
    const source = [
      { variantNumber: 'OGN-010', condition: 'near_mint', language: 'en', quantity: 4 },
    ];
    expect(mergeCollectionStacks([], source)).toEqual(source);
  });

  test('returns target unchanged when source is empty', () => {
    const target = [
      { variantNumber: 'OGN-010', condition: 'near_mint', language: 'en', quantity: 4 },
    ];
    expect(mergeCollectionStacks(target, [])).toEqual(target);
  });

  test('does not mutate input arrays', () => {
    const target = [
      { variantNumber: 'OGN-001', condition: 'near_mint', language: 'en', quantity: 1 },
    ];
    const source = [
      { variantNumber: 'OGN-001', condition: 'near_mint', language: 'en', quantity: 2 },
    ];
    const merged = mergeCollectionStacks(target, source);
    expect(target[0]?.quantity).toBe(1);
    expect(source[0]?.quantity).toBe(2);
    expect(merged[0]?.quantity).toBe(3);
  });

  test('keeps standard and foil finishes separate for the same variant number', () => {
    const merged = mergeCollectionStacks(
      [
        {
          variantNumber: 'VEN-074',
          condition: 'near_mint',
          language: 'en',
          quantity: 2,
          isFoil: false,
        },
      ],
      [
        {
          variantNumber: 'VEN-074',
          condition: 'near_mint',
          language: 'en',
          quantity: 3,
          isFoil: true,
        },
        {
          variantNumber: 'VEN-074',
          condition: 'near_mint',
          language: 'en',
          quantity: 1,
          isFoil: false,
        },
      ]
    );

    expect(merged).toHaveLength(2);
    expect(merged.find((s) => s.isFoil === false)?.quantity).toBe(3);
    expect(merged.find((s) => s.isFoil === true)?.quantity).toBe(3);
  });
});

describe('collection share contracts', () => {
  test('accept modes are use_theirs and merge', () => {
    expect(CollectionShareAcceptMode.parse('use_theirs')).toBe('use_theirs');
    expect(CollectionShareAcceptMode.parse('merge')).toBe('merge');
    expect(() => CollectionShareAcceptMode.parse('replace')).toThrow();
  });

  test('accept request requires mode', () => {
    expect(CollectionShareAcceptRequest.parse({ mode: 'merge' })).toEqual({
      mode: 'merge',
    });
    expect(() => CollectionShareAcceptRequest.parse({})).toThrow();
  });

  test('pending invite requires token, url, and expiresAt', () => {
    const invite = CollectionSharePendingInvite.parse({
      token: 'tok',
      url: buildCollectionInviteUrl('tok', APP_BASE),
      expiresAt: '2026-07-28T12:00:00.000Z',
    });
    expect(invite.url).toBe('https://rift.solace.onl/invite/tok');
  });

  test('invite create response wraps pending invite', () => {
    const parsed = CollectionShareInviteCreateResponse.parse({
      data: {
        token: 'abc',
        url: buildCollectionInviteUrl('abc', APP_BASE),
        expiresAt: '2026-07-28T12:00:00.000Z',
      },
    });
    expect(parsed.data.token).toBe('abc');
    expect(parsed.data.url).toContain(`/invite/${parsed.data.token}`);
  });

  test('share status can include pending invite without partner', () => {
    const status = CollectionShareStatus.parse({
      shared: false,
      memberCount: 1,
      collectionId: '11111111-1111-1111-1111-111111111111',
      role: 'owner',
      partner: null,
      pendingInvite: {
        token: 'tok',
        url: buildCollectionInviteUrl('tok', APP_BASE),
        expiresAt: '2026-07-28T12:00:00.000Z',
      },
    });
    expect(status.shared).toBe(false);
    expect(status.pendingInvite?.url).toContain('/invite/tok');
  });

  test('invite preview includes both inventory counts', () => {
    const preview = CollectionShareInvitePreview.parse({
      token: 'tok',
      expiresAt: '2026-07-28T12:00:00.000Z',
      inviter: {
        userId: 'u1',
        name: 'Alice',
      },
      theirItemCount: 2,
      theirTotalQuantity: 5,
      yourItemCount: 1,
      yourTotalQuantity: 3,
      canAccept: true,
      reason: null,
    });
    expect(preview.canAccept).toBe(true);
    expect(preview.theirTotalQuantity + preview.yourTotalQuantity).toBe(8);
  });
});
