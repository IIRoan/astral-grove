/** Riftbound table scoreboard — VP + XP for live play. */

export const PLAY_FORMATS = [
  {
    id: 'duel',
    label: 'Duel',
    description: '1v1 · first to 8',
    playerCount: 2,
    victoryScore: 8,
    teams: false,
    trackMatchWins: false,
  },
  {
    id: 'match',
    label: 'Match',
    description: '1v1 · best of 3 games to 8',
    playerCount: 2,
    victoryScore: 8,
    teams: false,
    trackMatchWins: true,
  },
  {
    id: 'skirmish',
    label: 'Skirmish',
    description: 'FFA3 · first to 8',
    playerCount: 3,
    victoryScore: 8,
    teams: false,
    trackMatchWins: false,
  },
  {
    id: 'war',
    label: 'War',
    description: 'FFA4 · first to 8',
    playerCount: 4,
    victoryScore: 8,
    teams: false,
    trackMatchWins: false,
  },
  {
    id: 'magma',
    label: 'Magma Chamber',
    description: '2v2 · team first to 11',
    playerCount: 4,
    victoryScore: 11,
    teams: true,
    trackMatchWins: false,
  },
] as const;

export type PlayFormatId = (typeof PLAY_FORMATS)[number]['id'];

export type PlayFormat = (typeof PLAY_FORMATS)[number];

export type TeamId = 'a' | 'b';

export type SeatLegend = {
  name: string;
  variantNumber: string;
  /** Printing label (Standard, Overnumbered, Signed, …) for alt-art flex. */
  variantLabel?: string;
  imageUrl?: string | null;
};

export type SeatState = {
  id: string;
  legend: SeatLegend | null;
  /** Victory points. Magma teammates share one team total (mirrored on both seats). */
  points: number;
  xp: number;
  matchWins: number;
  team?: TeamId;
};

export type ScoreTrackerState = {
  format: PlayFormatId;
  seats: SeatState[];
  /** Seat that reached the victory score (non-team formats). */
  winnerSeatId: string | null;
  /** Winning team in Magma Chamber. */
  winnerTeam: TeamId | null;
};

export function getPlayFormat(id: PlayFormatId): PlayFormat {
  const format = PLAY_FORMATS.find((entry) => entry.id === id);
  if (!format) {
    throw new Error(`Unknown play format: ${id}`);
  }
  return format;
}

/** Short table label — champion name before the title dash when present. */
export function seatDisplayName(seat: SeatState): string {
  if (!seat.legend) return 'Set legend';
  const dash = seat.legend.name.indexOf(' - ');
  if (dash > 0) return seat.legend.name.slice(0, dash);
  return seat.legend.name;
}

function defaultTeams(format: PlayFormat): Array<TeamId | undefined> {
  if (!format.teams) return Array.from({ length: format.playerCount }, () => undefined);
  // Seating: partners share a column (A left, B right).
  return ['a', 'b', 'a', 'b'];
}

export function createScoreTrackerState(
  formatId: PlayFormatId = 'duel'
): ScoreTrackerState {
  const format = getPlayFormat(formatId);
  const teams = defaultTeams(format);

  return {
    format: formatId,
    winnerSeatId: null,
    winnerTeam: null,
    seats: Array.from({ length: format.playerCount }, (_, index) => {
      const team = teams[index];
      return {
        id: `seat-${index}`,
        legend: null,
        points: 0,
        xp: 0,
        matchWins: 0,
        ...(team ? { team } : {}),
      };
    }),
  };
}

export function isOneAwayFromVictory(points: number, victoryScore: number): boolean {
  return points === victoryScore - 1;
}

function teamPoints(seats: SeatState[], team: TeamId): number {
  const member = seats.find((seat) => seat.team === team);
  return member?.points ?? 0;
}

export function evaluateWinners(
  state: ScoreTrackerState
): Pick<ScoreTrackerState, 'winnerSeatId' | 'winnerTeam'> {
  const format = getPlayFormat(state.format);

  if (format.teams) {
    const a = teamPoints(state.seats, 'a');
    const b = teamPoints(state.seats, 'b');
    if (a >= format.victoryScore && a > b)
      return { winnerSeatId: null, winnerTeam: 'a' };
    if (b >= format.victoryScore && b > a)
      return { winnerSeatId: null, winnerTeam: 'b' };
    // Keep the declared winner while they still sit at/above the victory score (trailing team can catch up).
    if (
      state.winnerTeam &&
      teamPoints(state.seats, state.winnerTeam) >= format.victoryScore
    ) {
      return { winnerSeatId: null, winnerTeam: state.winnerTeam };
    }
    return { winnerSeatId: null, winnerTeam: null };
  }

  const winners = state.seats.filter((seat) => seat.points >= format.victoryScore);
  if (winners.length === 1) {
    return { winnerSeatId: winners[0]?.id ?? null, winnerTeam: null };
  }
  if (winners.length > 1) {
    if (state.winnerSeatId && winners.some((seat) => seat.id === state.winnerSeatId)) {
      return { winnerSeatId: state.winnerSeatId, winnerTeam: null };
    }
    return { winnerSeatId: winners[0]?.id ?? null, winnerTeam: null };
  }
  return { winnerSeatId: null, winnerTeam: null };
}

function withWinners(state: ScoreTrackerState): ScoreTrackerState {
  return { ...state, ...evaluateWinners(state) };
}

export function setPlayFormat(
  _state: ScoreTrackerState,
  formatId: PlayFormatId
): ScoreTrackerState {
  return createScoreTrackerState(formatId);
}

export function setSeatLegend(
  state: ScoreTrackerState,
  seatId: string,
  legend: SeatLegend | null
): ScoreTrackerState {
  return {
    ...state,
    seats: state.seats.map((seat) => (seat.id === seatId ? { ...seat, legend } : seat)),
  };
}

export function adjustPoints(
  state: ScoreTrackerState,
  seatId: string,
  delta: number
): ScoreTrackerState {
  const format = getPlayFormat(state.format);
  const target = state.seats.find((seat) => seat.id === seatId);
  if (!target) return state;

  const nextPoints = Math.max(
    0,
    Math.min(format.victoryScore + 4, target.points + delta)
  );

  let seats: SeatState[];
  if (format.teams && target.team) {
    const team = target.team;
    seats = state.seats.map((seat) =>
      seat.team === team ? { ...seat, points: nextPoints } : seat
    );
  } else {
    seats = state.seats.map((seat) =>
      seat.id === seatId ? { ...seat, points: nextPoints } : seat
    );
  }

  return withWinners({ ...state, seats });
}

export function adjustXp(
  state: ScoreTrackerState,
  seatId: string,
  delta: number
): ScoreTrackerState {
  return {
    ...state,
    seats: state.seats.map((seat) => {
      if (seat.id !== seatId) return seat;
      return { ...seat, xp: Math.max(0, Math.min(99, seat.xp + delta)) };
    }),
  };
}

/** Clear VP and XP for a new game; keep legends and match wins. */
export function resetGame(state: ScoreTrackerState): ScoreTrackerState {
  return withWinners({
    ...state,
    winnerSeatId: null,
    winnerTeam: null,
    seats: state.seats.map((seat) => ({ ...seat, points: 0, xp: 0 })),
  });
}

/** After a Match (Bo3) game win, credit the winner and clear VP/XP; no-op if no winner / non-match format. */
export function advanceMatchGame(state: ScoreTrackerState): ScoreTrackerState {
  const format = getPlayFormat(state.format);
  if (!format.trackMatchWins || !state.winnerSeatId) return state;

  const seats = state.seats.map((seat) => ({
    ...seat,
    points: 0,
    xp: 0,
    matchWins: seat.id === state.winnerSeatId ? seat.matchWins + 1 : seat.matchWins,
  }));

  return {
    ...state,
    seats,
    winnerSeatId: null,
    winnerTeam: null,
  };
}

export function matchSeriesWinner(state: ScoreTrackerState): string | null {
  const format = getPlayFormat(state.format);
  if (!format.trackMatchWins) return null;
  const champ = state.seats.find((seat) => seat.matchWins >= 2);
  return champ?.id ?? null;
}
