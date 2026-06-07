"use client";

import { load, save } from "./store";

// Per-device Elo: each question is a "match" vs an opponent whose strength comes
// from how obscure the prompt is (famous = weak opponent, obscure = strong). See
// BLUEPRINT §8. State lives behind load/save so a future accounts phase is a swap.

const KEY = "f26.elo.v1";
export const START = 800;

export type EloState = {
  rating: number;
  peak: number;
  low: number;
  games: number;
  wins: number;
  history: number[]; // capped, powers the chart
  updatedAt: number;
};

export const defElo = (): EloState => ({
  rating: START, peak: START, low: START, games: 0, wins: 0, history: [START], updatedAt: 0,
});

export function loadElo(): EloState {
  const s = load<EloState>(KEY, defElo());
  // Reconcile peak/low against the data so an old blob can't claim a high/low
  // the history + current rating contradict.
  const all = [...(s.history ?? []), s.rating];
  s.peak = Math.max(s.peak ?? START, ...all);
  s.low = Math.min(s.low ?? START, ...all);
  return s;
}

export const saveElo = (s: EloState) => save(KEY, s);

export const expected = (rating: number, opponent: number) =>
  1 / (1 + Math.pow(10, (opponent - rating) / 400));

const kFactor = (games: number) => (games < 30 ? 40 : games < 100 ? 24 : 16);

// difficulty in [0,1] (0 = famous/easy, 1 = obscure/hard) -> opponent rating
export const opponentRating = (difficulty: number) => 700 + (2000 - 700) * difficulty;

export function applyResult(s: EloState, won: boolean, difficulty: number): { next: EloState; delta: number } {
  const opponent = opponentRating(difficulty);
  const exp = expected(s.rating, opponent);
  const delta = Math.round(kFactor(s.games) * ((won ? 1 : 0) - exp));
  const rating = Math.max(100, s.rating + delta);
  const next: EloState = {
    rating,
    peak: Math.max(s.peak, rating),
    low: Math.min(s.low, rating),
    games: s.games + 1,
    wins: s.wins + (won ? 1 : 0),
    history: [...s.history, rating].slice(-250),
    updatedAt: Date.now(),
  };
  return { next, delta };
}

export type EloStatus = "peak" | "low" | "up" | "down" | "steady";

export function eloStatus(s: EloState): EloStatus {
  if (s.games >= 5 && s.rating >= s.peak) return "peak";
  if (s.games >= 5 && s.rating <= s.low) return "low";
  const h = s.history;
  if (h.length >= 4) {
    const recent = h.slice(-4);
    const diff = recent[recent.length - 1] - recent[0];
    if (diff > 8) return "up";
    if (diff < -8) return "down";
  }
  return "steady";
}
