import { describe, expect, mock, test } from 'bun:test';
import type { CardListItem } from '@riftbound/contracts';
import {
  createScanConfirmation,
  scanAddInput,
  scanFinishOptions,
} from './scan-confirmation';

const card: CardListItem = {
  cardId: 'card-1',
  variantNumber: 'OGN-001',
  name: 'Test card',
  type: 'Unit',
  energy: 1,
  might: 1,
  power: 1,
  rarity: 'Common',
  setCode: 'OGN',
  colors: [],
  imageUrl: '',
  cardmarketId: null,
  priceEur: null,
  isBanned: false,
  printings: [
    {
      variantNumber: 'OGN-001',
      variantLabel: 'Standard',
      isFoil: false,
      priceEur: null,
    },
    { variantNumber: 'OGN-001', variantLabel: 'Foil', isFoil: true, priceEur: null },
  ],
};
const outcome = { kind: 'card' as const, card, via: 'code' as const, sure: true };

describe('scan confirmation', () => {
  test('even a sure match waits for Yes, saves once, then clears for the next card', async () => {
    let finish!: () => void;
    const save = mock(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    const settled = mock(() => undefined);
    const session = createScanConfirmation(save, settled);
    session.present(outcome);
    expect(save).not.toHaveBeenCalled();
    const saving = session.confirm();
    void session.confirm();
    session.reject();
    session.present({ ...outcome, card: { ...card, name: 'Different card' } });
    expect(save).toHaveBeenCalledTimes(1);
    expect(session.getSnapshot().pending).toEqual(outcome);
    expect(session.getSnapshot().saving).toBe(true);
    finish();
    await saving;
    expect(session.getSnapshot()).toMatchObject({
      pending: null,
      saving: false,
      totalCopies: 1,
      justAdded: card.name,
    });
    expect(settled).toHaveBeenCalledTimes(1);
    session.present({ ...outcome, card: { ...card, variantNumber: 'OGN-002' } });
    expect(session.getSnapshot().pending?.kind).toBe('card');
  });

  test('No clears the match without adding anything', () => {
    const save = mock(async () => undefined);
    const session = createScanConfirmation(save, () => undefined);
    session.present(outcome);
    session.reject();
    expect(session.getSnapshot().pending).toBeNull();
    expect(session.getSnapshot().totalCopies).toBe(0);
    expect(save).not.toHaveBeenCalled();
  });

  test('a failed save keeps the card available for retry', async () => {
    const save = mock(async () => {
      throw new Error('Connection lost');
    });
    const settled = mock(() => undefined);
    const session = createScanConfirmation(save, settled);
    session.present(outcome);
    await session.confirm();
    expect(session.getSnapshot()).toMatchObject({
      pending: outcome,
      saving: false,
      error: 'Connection lost',
      totalCopies: 0,
    });
    expect(settled).not.toHaveBeenCalled();
    save.mockImplementation(async () => undefined);
    await session.confirm();
    expect(session.getSnapshot()).toMatchObject({
      pending: null,
      error: null,
      totalCopies: 1,
    });
  });

  test('choosing an ambiguous printing still requires Yes', async () => {
    const save = mock(async () => undefined);
    const session = createScanConfirmation(save, () => undefined);
    session.present({ kind: 'ambiguous', name: card.name, options: [card] });
    session.select(card);
    expect(save).not.toHaveBeenCalled();
    expect(session.getSnapshot().pending).toMatchObject({ kind: 'card', card });
    await session.confirm('OGN-001::foil');
    expect(save).toHaveBeenCalledWith(card, 'OGN-001::foil');
  });

  test('a later confirmed copy of the same card increments the session total', async () => {
    const save = mock(async () => undefined);
    const session = createScanConfirmation(save, () => undefined);
    for (let i = 0; i < 2; i++) {
      session.present(outcome);
      await session.confirm();
    }
    expect(save).toHaveBeenCalledTimes(2);
    expect(session.getSnapshot().totalCopies).toBe(2);
  });
});

describe('scan finish', () => {
  test('quick add uses the normal finish even when foil is listed first', () => {
    expect(
      scanAddInput(
        { ...card, printings: [...card.printings!].reverse() },
        { simpleAdd: true }
      )
    ).toMatchObject({ variantNumber: 'OGN-001', isFoil: false });
    expect(scanFinishOptions(card, true)).toBeNull();
  });

  test('a foil-only printing adds that foil instead of another printing', () => {
    const foilOnly = {
      ...card,
      printings: [
        {
          variantNumber: 'OGN-001',
          variantLabel: 'Foil',
          isFoil: true,
          priceEur: null,
        },
        {
          variantNumber: 'OGN-002',
          variantLabel: 'Standard',
          isFoil: false,
          priceEur: null,
        },
      ],
    };
    expect(scanAddInput(foilOnly, { simpleAdd: true })).toMatchObject({
      variantNumber: 'OGN-001',
      isFoil: true,
    });
    expect(scanFinishOptions(foilOnly, false)).toBeNull();
  });

  test('without quick add, both finishes are a choice and the picked one is saved', () => {
    expect(scanFinishOptions(card, false)?.map((option) => option.label)).toEqual([
      'Standard',
      'Foil',
    ]);
    expect(
      scanAddInput(card, { simpleAdd: false, selectionId: 'OGN-001::foil' })
    ).toMatchObject({ variantNumber: 'OGN-001', isFoil: true });
  });
});
