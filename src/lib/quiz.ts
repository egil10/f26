"use client";

import {
  CONFEDS, CONFED_LABEL, GROUPS, POSITIONS, POS_LABEL,
  type Confed, type Data, type Player, type Pos, type Team,
} from "./data";

// ---------------------------------------------------------------- seeded RNG
export function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const shuffle = <T>(arr: T[], rng: () => number): T[] => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ---------------------------------------------------------------- modes
export type ModeKey = "nation" | "club" | "position" | "group" | "flag" | "league";
export type PromptKind = "player" | "team" | "flag";
export type ChoiceKind = "flag" | "text";

export type Mode = {
  key: ModeKey;
  label: string;
  hint: string;
  prompt: PromptKind;
  choices: ChoiceKind;
};

export const MODES: Mode[] = [
  { key: "nation", label: "Nation", hint: "Which national team does this player represent?", prompt: "player", choices: "flag" },
  { key: "club", label: "Club", hint: "Which club does this player play for?", prompt: "player", choices: "text" },
  { key: "position", label: "Position", hint: "What position does this player play?", prompt: "player", choices: "text" },
  { key: "league", label: "League", hint: "In which country does this player's club play?", prompt: "player", choices: "flag" },
  { key: "group", label: "Group", hint: "Which group is this team drawn in?", prompt: "team", choices: "text" },
  { key: "flag", label: "Flag", hint: "Which country's flag is this?", prompt: "flag", choices: "text" },
];

export const modeByKey = (k: ModeKey) => MODES.find((m) => m.key === k) ?? MODES[0];

// ---------------------------------------------------------------- categories
export type Category = {
  key: string;
  label: string;
  group: string;
  filter: (p: Player, rank: number) => boolean;
};

export const CATEGORIES: Category[] = [
  { key: "all", label: "All players", group: "Pool", filter: () => true },
  { key: "stars", label: "Stars", group: "Pool", filter: (_p, rank) => rank < 160 },
  ...CONFEDS.map((c): Category => ({
    key: `confed:${c}`, label: CONFED_LABEL[c], group: "Confederation",
    filter: (p) => p.confed === c,
  })),
  ...GROUPS.map((g): Category => ({
    key: `group:${g}`, label: `Group ${g}`, group: "Group",
    filter: (p) => p.group === g,
  })),
];

export const categoryByKey = (k: string) => CATEGORIES.find((c) => c.key === k) ?? CATEGORIES[0];

// ---------------------------------------------------------------- indexes
export type Indexes = {
  playerRank: Map<string, number>;            // player id -> fame index (0 = most famous)
  teamRank: Map<string, number>;              // team id -> obscurity index (0 = most famous)
  teamsByName: Map<string, Team>;
  teamList: { name: string; iso2: string; confed: Confed }[];
  clubs: string[];
  clubLeague: Map<string, string | null>;     // club -> FIFA-3 league code
  clubsByLeague: Map<string, string[]>;
  leagueList: { code: string; name: string; iso2: string }[];
};

export function buildIndexes(data: Data): Indexes {
  const { players, teams, leagues } = data;

  const playerRank = new Map<string, number>();
  players.forEach((p, i) => playerRank.set(p.id, i)); // players.json is fame-sorted

  // Team obscurity from total squad fame (well-known squads = low index).
  const teamFame = new Map<string, number>();
  for (const p of players) teamFame.set(p.teamId, (teamFame.get(p.teamId) ?? 0) + p.fame);
  const teamRank = new Map<string, number>();
  [...teams]
    .sort((a, b) => (teamFame.get(b.id) ?? 0) - (teamFame.get(a.id) ?? 0))
    .forEach((t, i) => teamRank.set(t.id, i));

  const teamsByName = new Map(teams.map((t) => [t.name, t]));
  const teamList = teams.map((t) => ({ name: t.name, iso2: t.iso2, confed: t.confed }));

  const clubLeague = new Map<string, string | null>();
  const clubsByLeague = new Map<string, string[]>();
  for (const p of players) {
    if (!clubLeague.has(p.club)) {
      clubLeague.set(p.club, p.clubNat);
      const key = p.clubNat ?? "";
      const list = clubsByLeague.get(key) ?? [];
      list.push(p.club);
      clubsByLeague.set(key, list);
    }
  }
  const clubs = [...clubLeague.keys()];
  const leagueList = Object.entries(leagues).map(([code, l]) => ({ code, name: l.name, iso2: l.iso2 }));

  return { playerRank, teamRank, teamsByName, teamList, clubs, clubLeague, clubsByLeague, leagueList };
}

// ---------------------------------------------------------------- round
export type Choice = { value: string; iso2?: string };

export type Round = {
  id: string;
  itemId: string;          // player or team id, for recency
  mode: ModeKey;
  prompt: PromptKind;
  choiceKind: ChoiceKind;
  player?: Player;
  team?: Team;
  correct: string;
  choices: Choice[];
  difficulty: number;      // [0,1] for Elo
  hint: string;
  review?: boolean;        // resurfaced from the missed-questions queue
};

// Build the pool of players for a category (used for player-prompt modes).
export function buildPool(data: Data, category: Category, idx: Indexes): Player[] {
  return data.players.filter((p) => category.filter(p, idx.playerRank.get(p.id) ?? 0));
}

// Distinct teams represented in a player pool (for team/flag modes).
export function poolTeams(pool: Player[], data: Data): Team[] {
  const ids = new Set(pool.map((p) => p.teamId));
  return data.teams.filter((t) => ids.has(t.id));
}

function sampleDistinct<T>(
  source: T[], n: number, exclude: Set<string>, keyOf: (t: T) => string, rng: () => number,
): T[] {
  const out: T[] = [];
  const used = new Set(exclude);
  const pool = source.slice();
  while (out.length < n && pool.length) {
    const i = Math.floor(rng() * pool.length);
    const [item] = pool.splice(i, 1);
    const k = keyOf(item);
    if (used.has(k)) continue;
    used.add(k);
    out.push(item);
  }
  return out;
}

// Pick an item, hard-excluding the recently shown ones so names don't recur until
// roughly half the pool has gone by, and avoiding the last few answers back-to-back.
// Falls back gracefully when a narrow pool is exhausted.
function pickItem<T>(
  arr: T[], rng: () => number, keyOf: (t: T) => string, ansOf: (t: T) => string,
  recentItems: string[], recentAnswers: string[],
): T {
  if (arr.length <= 1) return arr[0];
  const window = Math.max(5, Math.floor(arr.length * 0.5));
  const recentSet = new Set(recentItems.slice(0, window));
  let fresh = arr.filter((x) => !recentSet.has(keyOf(x)));
  if (fresh.length === 0) fresh = arr;
  const recentAns = new Set(recentAnswers);
  const fresher = fresh.filter((x) => !recentAns.has(ansOf(x)));
  const pick = fresher.length ? fresher : fresh;
  return pick[Math.floor(rng() * pick.length)];
}

export function makeRound(args: {
  mode: Mode;
  pool: Player[];
  data: Data;
  idx: Indexes;
  category: Category;
  rng: () => number;
  recentItems: string[];
  recentAnswers: string[];
  serial: number;
  force?: Player | Team;   // resurface a specific item (Review mode)
  review?: boolean;
}): Round {
  const { mode, pool, data, idx, category, rng, recentItems, recentAnswers, serial, force, review } = args;
  const N = data.players.length;

  // Distractor teams: 2 from the same confederation (plausible) + the rest from anywhere.
  const teamDistractors = (correctName: string, confed: Confed) => {
    const near = sampleDistinct(
      idx.teamList.filter((t) => t.confed === confed && t.name !== correctName),
      2, new Set([correctName]), (t) => t.name, rng,
    );
    const exclude = new Set([correctName, ...near.map((t) => t.name)]);
    const far = sampleDistinct(idx.teamList, 3 - near.length, exclude, (t) => t.name, rng);
    return [...near, ...far];
  };

  if (mode.prompt === "team" || mode.prompt === "flag") {
    // Group can't be filtered by group (that would fix the answer), so it's scoped
    // by confederation only; flag respects whatever pool is selected.
    let teams: Team[];
    if (mode.key === "group") {
      teams = category.key.startsWith("confed:")
        ? data.teams.filter((t) => `confed:${t.confed}` === category.key)
        : data.teams;
    } else {
      teams = poolTeams(pool, data);
    }
    if (teams.length === 0) teams = data.teams;

    const team = (force as Team) ?? pickItem(
      teams, rng, (t) => t.id,
      (t) => (mode.key === "group" ? t.group : t.name),
      recentItems, recentAnswers,
    );
    const difficulty = (idx.teamRank.get(team.id) ?? 0) / Math.max(1, data.teams.length - 1);

    let correct: string;
    let choices: Choice[];
    if (mode.key === "group") {
      correct = team.group;
      const distract = sampleDistinct(GROUPS, 3, new Set([team.group]), (g) => g, rng);
      choices = shuffle([correct, ...distract].map((v) => ({ value: v })), rng);
    } else {
      correct = team.name;
      const distract = teamDistractors(team.name, team.confed);
      choices = shuffle([{ value: team.name }, ...distract.map((t) => ({ value: t.name }))], rng);
    }
    return {
      id: `${team.id}:${serial}`, itemId: team.id, mode: mode.key, prompt: mode.prompt,
      choiceKind: mode.choices, team, correct, choices, difficulty, hint: mode.hint, review,
    };
  }

  // Player-based modes: nation / club / position / league.
  let players = pool;
  if (mode.key === "league") players = pool.filter((p) => p.clubNat && data.leagues[p.clubNat]);
  if (players.length === 0) players = data.players;
  const ansOf = (p: Player): string =>
    mode.key === "nation" ? p.team
    : mode.key === "club" ? p.club
    : mode.key === "position" ? (p.pos ?? "")
    : data.leagues[p.clubNat!].name; // league

  const player = (force as Player) ?? pickItem(players, rng, (p) => p.id, ansOf, recentItems, recentAnswers);
  const difficulty = (idx.playerRank.get(player.id) ?? 0) / Math.max(1, N - 1);
  const correct = ansOf(player);

  let choices: Choice[];
  if (mode.key === "nation") {
    const distract = teamDistractors(player.team, player.confed);
    choices = shuffle(
      [{ value: player.team, iso2: player.iso2 }, ...distract.map((t) => ({ value: t.name, iso2: t.iso2 }))],
      rng,
    );
  } else if (mode.key === "position") {
    const distract = POSITIONS.filter((p) => p !== player.pos).slice(0, 3);
    choices = shuffle([player.pos!, ...distract].map((v) => ({ value: v })), rng);
  } else if (mode.key === "league") {
    const league = data.leagues[player.clubNat!];
    const distract = sampleDistinct(idx.leagueList, 3, new Set([league.name]), (l) => l.name, rng);
    choices = shuffle(
      [{ value: league.name, iso2: league.iso2 }, ...distract.map((l) => ({ value: l.name, iso2: l.iso2 }))],
      rng,
    );
  } else {
    // club — prefer same-league clubs as distractors so options look plausible
    const sameLeague = (idx.clubsByLeague.get(player.clubNat ?? "") ?? []).filter((c) => c !== player.club);
    const near = sampleDistinct(sameLeague, 3, new Set([player.club]), (c) => c, rng);
    const need = 3 - near.length;
    const far = need > 0 ? sampleDistinct(idx.clubs, need, new Set([player.club, ...near]), (c) => c, rng) : [];
    choices = shuffle([player.club, ...near, ...far].map((v) => ({ value: v })), rng);
  }

  return {
    id: `${player.id}:${serial}`, itemId: player.id, mode: mode.key, prompt: mode.prompt,
    choiceKind: mode.choices, player, correct, choices, difficulty, hint: mode.hint, review,
  };
}

// Position label helper re-export for the UI.
export const posLabel = (p: Pos | string | null) => (p ? POS_LABEL[p as Pos] ?? p : "");
