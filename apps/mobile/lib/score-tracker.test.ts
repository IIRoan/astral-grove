import { describe, expect, test } from 'bun:test';
import {
  adjustPoints,
  adjustXp,
  advanceMatchGame,
  createScoreTrackerState,
  evaluateWinners,
  getPlayFormat,
  isOneAwayFromVictory,
  matchSeriesWinner,
  resetGame,
  seatDisplayName,
  setPlayFormat,
  setSeatLegend,
} from '@/lib/score-tracker';

describe('score-tracker formats', () => {
  test('maps official victory scores', () => {
    expect(getPlayFormat('duel').victoryScore).toBe(8);
    expect(getPlayFormat('match').victoryScore).toBe(8);
    expect(getPlayFormat('skirmish').victoryScore).toBe(8);
    expect(getPlayFormat('war').victoryScore).toBe(8);
    expect(getPlayFormat('magma').victoryScore).toBe(11);
  });

  test('creates the right seat counts', () => {
    expect(createScoreTrackerState('duel').seats).toHaveLength(2);
    expect(createScoreTrackerState('skirmish').seats).toHaveLength(3);
    expect(createScoreTrackerState('war').seats).toHaveLength(4);
    expect(createScoreTrackerState('magma').seats).toHaveLength(4);
  });

  test('seats start without legends', () => {
    const state = createScoreTrackerState('duel');
    expect(state.seats.every((seat) => seat.legend === null)).toBe(true);
  });

  test('setSeatLegend assigns a legend', () => {
    let state = createScoreTrackerState('duel');
    const seatA = state.seats[0]!.id;
    state = setSeatLegend(state, seatA, {
      name: 'Jinx - Loose Cannon',
      variantNumber: 'OGN-123',
      imageUrl: null,
    });
    expect(seatDisplayName(state.seats[0]!)).toBe('Jinx');
    expect(state.seats[0]!.legend?.variantNumber).toBe('OGN-123');
  });
});

describe('score-tracker scoring', () => {
  test('clamps points at zero and awards a duel win at 8', () => {
    let state = createScoreTrackerState('duel');
    const seatA = state.seats[0]!.id;
    state = adjustPoints(state, seatA, -1);
    expect(state.seats[0]!.points).toBe(0);

    for (let i = 0; i < 8; i++) state = adjustPoints(state, seatA, 1);
    expect(state.seats[0]!.points).toBe(8);
    expect(state.winnerSeatId).toBe(seatA);
  });

  test('flags one away from victory', () => {
    expect(isOneAwayFromVictory(7, 8)).toBe(true);
    expect(isOneAwayFromVictory(10, 11)).toBe(true);
    expect(isOneAwayFromVictory(6, 8)).toBe(false);
  });

  test('magma mirrors team points and wins at 11', () => {
    let state = createScoreTrackerState('magma');
    const a1 = state.seats[0]!.id;
    for (let i = 0; i < 11; i++) state = adjustPoints(state, a1, 1);
    expect(state.seats[0]!.points).toBe(11);
    expect(state.seats[2]!.points).toBe(11);
    expect(state.winnerTeam).toBe('a');
  });

  test('xp never goes negative', () => {
    let state = createScoreTrackerState('duel');
    const seatA = state.seats[0]!.id;
    state = adjustXp(state, seatA, -3);
    expect(state.seats[0]!.xp).toBe(0);
    state = adjustXp(state, seatA, 4);
    expect(state.seats[0]!.xp).toBe(4);
  });
});

describe('score-tracker match', () => {
  test('advanceMatchGame credits the winner and clears the board', () => {
    let state = createScoreTrackerState('match');
    const seatA = state.seats[0]!.id;
    for (let i = 0; i < 8; i++) state = adjustPoints(state, seatA, 1);
    state = adjustXp(state, seatA, 2);
    state = advanceMatchGame(state);
    expect(state.seats[0]!.matchWins).toBe(1);
    expect(state.seats[0]!.points).toBe(0);
    expect(state.seats[0]!.xp).toBe(0);
    expect(state.winnerSeatId).toBeNull();
  });

  test('series ends at two match wins', () => {
    let state = createScoreTrackerState('match');
    const seatA = state.seats[0]!.id;
    state = {
      ...state,
      seats: state.seats.map((seat) =>
        seat.id === seatA ? { ...seat, matchWins: 2 } : seat
      ),
    };
    expect(matchSeriesWinner(state)).toBe(seatA);
  });

  test('resetGame clears points and xp but keeps legends and match wins', () => {
    let state = createScoreTrackerState('match');
    const seatA = state.seats[0]!.id;
    state = setSeatLegend(state, seatA, {
      name: 'Jinx - Loose Cannon',
      variantNumber: 'OGN-123',
      imageUrl: null,
    });
    state = {
      ...state,
      seats: state.seats.map((seat) =>
        seat.id === seatA ? { ...seat, matchWins: 1, points: 5, xp: 3 } : seat
      ),
    };
    state = resetGame(state);
    expect(state.seats[0]!.matchWins).toBe(1);
    expect(state.seats[0]!.points).toBe(0);
    expect(state.seats[0]!.xp).toBe(0);
    expect(state.seats[0]!.legend?.variantNumber).toBe('OGN-123');
  });

  test('keeps the first duel winner when a second seat also reaches 8', () => {
    let state = createScoreTrackerState('duel');
    const seatA = state.seats[0]!.id;
    const seatB = state.seats[1]!.id;
    for (let i = 0; i < 8; i++) state = adjustPoints(state, seatA, 1);
    expect(state.winnerSeatId).toBe(seatA);
    for (let i = 0; i < 8; i++) state = adjustPoints(state, seatB, 1);
    expect(state.winnerSeatId).toBe(seatA);
  });

  test('keeps the magma winner when the trailing team catches the threshold', () => {
    let state = createScoreTrackerState('magma');
    const a1 = state.seats[0]!.id;
    const b1 = state.seats[1]!.id;
    for (let i = 0; i < 11; i++) state = adjustPoints(state, a1, 1);
    expect(state.winnerTeam).toBe('a');
    for (let i = 0; i < 11; i++) state = adjustPoints(state, b1, 1);
    expect(state.winnerTeam).toBe('a');
  });

  test('setPlayFormat rebuilds seats', () => {
    const duel = createScoreTrackerState('duel');
    const war = setPlayFormat(duel, 'war');
    expect(war.format).toBe('war');
    expect(war.seats).toHaveLength(4);
    expect(evaluateWinners(war)).toEqual({ winnerSeatId: null, winnerTeam: null });
  });

  test('changing legend replaces the previous printing', () => {
    let state = createScoreTrackerState('duel');
    const seatA = state.seats[0]!.id;
    state = setSeatLegend(state, seatA, {
      name: 'Jinx - Loose Cannon',
      variantNumber: 'OGN-280',
      imageUrl: 'https://cdn.example.com/std.webp',
    });
    state = setSeatLegend(state, seatA, {
      name: 'Jinx - Loose Cannon',
      variantNumber: 'OGN-280a',
      variantLabel: 'Overnumbered',
      imageUrl: 'https://cdn.example.com/alt.webp',
    });
    expect(state.seats[0]!.legend?.variantNumber).toBe('OGN-280a');
    expect(state.seats[0]!.legend?.variantLabel).toBe('Overnumbered');
  });

  test('magma team win requires a leading team at 11', () => {
    let state = createScoreTrackerState('magma');
    const a1 = state.seats[0]!.id;
    const b1 = state.seats[1]!.id;
    for (let i = 0; i < 10; i++) state = adjustPoints(state, a1, 1);
    for (let i = 0; i < 11; i++) state = adjustPoints(state, b1, 1);
    expect(state.winnerTeam).toBe('b');
  });
});
