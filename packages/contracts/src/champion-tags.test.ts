import { describe, expect, test } from 'bun:test';
import {
  cardPrimaryNameToken,
  legendChampionTags,
  sharesLegendChampionTag,
} from './champion-tags.js';

describe('cardPrimaryNameToken', () => {
  test('extracts name before comma', () => {
    expect(cardPrimaryNameToken({ name: 'Darius, Hand of Noxus' })).toBe('Darius');
    expect(cardPrimaryNameToken({ name: 'Darius, Executioner' })).toBe('Darius');
  });

  test('extracts name before dash subtitle', () => {
    expect(cardPrimaryNameToken({ name: 'Jinx - Loose Cannon' })).toBe('Jinx');
    expect(cardPrimaryNameToken({ name: 'Diana - Scorn of the Moon' })).toBe('Diana');
  });
});

describe('sharesLegendChampionTag', () => {
  test('matches Darius legend and champion by primary name when tags are domains only', () => {
    const legend = {
      name: 'Darius, Hand of Noxus',
      tags: ['Noxus', 'Fury', 'Order'],
    };
    const champion = {
      name: 'Darius, Executioner',
      tags: ['Noxus', 'Fury'],
    };

    expect(sharesLegendChampionTag(legend, champion)).toBe(true);
  });

  test('matches explicit champion tags', () => {
    const legend = { name: 'Jinx - Loose Cannon', tags: ['Jinx'] };
    const champion = { name: 'Jinx - Demolitionist', tags: ['Jinx'] };

    expect(sharesLegendChampionTag(legend, champion)).toBe(true);
  });

  test('rejects unrelated champions', () => {
    const legend = { name: 'Jinx - Loose Cannon', tags: ['Jinx'] };
    const champion = { name: 'Ahri - Nine-Tailed Fox', tags: ['Ahri'] };

    expect(sharesLegendChampionTag(legend, champion)).toBe(false);
  });

  test('matches when legend tags are missing but names share champion', () => {
    const legend = { name: 'Diana, Scorn of the Moon', tags: [] };
    const champion = { name: 'Diana - Scorn of the Moon', tags: [] };

    expect(legendChampionTags(legend)).toEqual(['Diana']);
    expect(sharesLegendChampionTag(legend, champion)).toBe(true);
  });

  test('matches the champion tag exactly, not as a name substring (CR 103.3.a.2)', () => {
    const vi = { name: 'Vi, Piltover Enforcer', tags: ['Vi'] };
    expect(
      sharesLegendChampionTag(vi, { name: 'Vi, Destructive', tags: ['Vi', 'Piltover'] })
    ).toBe(true);
    expect(
      sharesLegendChampionTag(vi, { name: 'Viktor, Leader', tags: ['Viktor', 'Zaun'] })
    ).toBe(false);
    expect(
      sharesLegendChampionTag(vi, {
        name: 'Fiora, Victorious',
        tags: ['Fiora', 'Demacia'],
      })
    ).toBe(false);
    expect(
      sharesLegendChampionTag(vi, {
        name: "Kai'Sa, Survivor",
        tags: ["Kai'Sa", 'The Void'],
      })
    ).toBe(false);
    expect(sharesLegendChampionTag(vi, { name: 'Viktor, Leader', tags: [] })).toBe(
      false
    );
    expect(sharesLegendChampionTag(vi, { name: 'vi, destructive', tags: [] })).toBe(
      true
    );
  });

  test('matches Sett when legend tags are wrong but names contain Sett', () => {
    const legend = { name: 'Sett, The Boss', tags: ['Body', 'Order'] };
    const champion = { name: 'Sett, Brawler', tags: ['Sett', 'Ionia'] };

    expect(sharesLegendChampionTag(legend, champion)).toBe(true);
  });
});
