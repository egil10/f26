// Smoke-test the real quiz engine against the shipped JSON: every mode × every
// category, many rounds, asserting the core invariants the UI relies on.
//   npx tsx scripts/engine-check.mts

import fs from "node:fs";
import {
  MODES, CATEGORIES, buildIndexes, buildPool, makeRound, mulberry32,
} from "../src/lib/quiz.ts";
import type { Data } from "../src/lib/data.ts";

const read = (f: string) => JSON.parse(fs.readFileSync(`public/${f}`, "utf8"));
const data: Data = { players: read("players.json"), teams: read("teams.json"), leagues: read("leagues.json") };

const idx = buildIndexes(data);
const rng = mulberry32(987654321);

let checks = 0;
const fails: string[] = [];
const fail = (msg: string, ...ctx: unknown[]) => fails.push(`${msg} — ${ctx.map(String).join(", ")}`);

for (const mode of MODES) {
  for (const cat of CATEGORIES) {
    const pool = buildPool(data, cat, idx);
    if (!pool.length) { fail("empty pool", mode.key, cat.key); continue; }
    for (let i = 0; i < 60; i++) {
      const r = makeRound({ mode, pool, data, idx, category: cat, rng, recentItems: [], recentAnswers: [], serial: i });
      checks++;
      const vals = r.choices.map((c) => c.value);
      if (r.choices.length !== 4) fail("not 4 choices", mode.key, cat.key, r.choices.length);
      if (!vals.includes(r.correct)) fail("correct missing", mode.key, cat.key, r.correct, `[${vals}]`);
      if (new Set(vals).size !== 4) fail("duplicate choices", mode.key, cat.key, `[${vals}]`);
      if (r.difficulty < 0 || r.difficulty > 1 || Number.isNaN(r.difficulty)) fail("bad difficulty", mode.key, r.difficulty);
      if (r.choiceKind === "flag" && r.choices.some((c) => !c.iso2)) fail("flag choice without iso2", mode.key, cat.key);
      if (mode.prompt === "player" && !r.player) fail("player prompt without player", mode.key);
      if ((mode.prompt === "team" || mode.prompt === "flag") && !r.team) fail("team prompt without team", mode.key);
    }
  }
}

// --- anti-repeat: thread recency like the reducer; no player should recur soon ---
{
  const mode = MODES.find((m) => m.key === "nation")!;
  const pool = buildPool(data, CATEGORIES[0], idx); // all players
  let recentItems: string[] = [];
  let recentAnswers: string[] = [];
  const seenAt = new Map<string, number>();
  let minGap = Infinity;
  for (let i = 0; i < 400; i++) {
    const r = makeRound({ mode, pool, data, idx, category: CATEGORIES[0], rng, recentItems, recentAnswers, serial: i });
    if (seenAt.has(r.itemId)) minGap = Math.min(minGap, i - seenAt.get(r.itemId)!);
    seenAt.set(r.itemId, i);
    recentItems = [r.itemId, ...recentItems].slice(0, 100);
    recentAnswers = [r.correct, ...recentAnswers].slice(0, 8);
  }
  checks += 400;
  if (minGap < 50) fail("a player recurred too soon", `gap ${minGap}`);
  console.log(`anti-repeat: min gap between the same player over 400 rounds = ${minGap === Infinity ? "no repeats" : minGap}`);
}

// --- force (Review mode) re-asks the exact item ---
{
  const mode = MODES.find((m) => m.key === "club")!;
  const pool = buildPool(data, CATEGORIES[0], idx);
  const target = data.players[123];
  const r = makeRound({ mode, pool, data, idx, category: CATEGORIES[0], rng, recentItems: [], recentAnswers: [], serial: 1, force: target, review: true });
  checks++;
  if (r.itemId !== target.id) fail("force ignored", r.itemId, target.id);
  if (!r.review) fail("review flag not set");
  if (r.correct !== target.club) fail("forced club mismatch", r.correct, target.club);
}

console.log(`ran ${checks} rounds across ${MODES.length} modes × ${CATEGORIES.length} categories`);
if (fails.length) {
  console.error(`FAILED (${fails.length}):`);
  for (const f of [...new Set(fails)].slice(0, 20)) console.error("  • " + f);
  process.exit(1);
}
console.log("all invariants hold ✓");
