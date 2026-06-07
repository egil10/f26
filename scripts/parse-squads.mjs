// Parse the Wikipedia "2026 FIFA World Cup squads" wikitext into the two JSON
// files the app ships: public/players.json (the flat quiz pool) and
// public/teams.json (team metadata for the squad browser + flag lookups).
//
//   node scripts/fetch-squads.mjs   # downloads data-raw/squads.wikitext
//   node scripts/parse-squads.mjs   # -> public/players.json, public/teams.json
//
// Source: https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads (CC BY-SA 4.0)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TEAM_META, FIFA3_TO_ISO2, FIFA3_TO_NAME } from "./countries.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "data-raw", "squads.wikitext");
const OUT = path.join(ROOT, "public");

const TOURNAMENT_START = { y: 2026, m: 6, d: 11 }; // ages are as of the first match

// Elite clubs get a small fame bump so young stars surface near famous veterans.
const ELITE = [
  "Real Madrid", "Barcelona", "Manchester City", "Manchester United",
  "Liverpool", "Arsenal", "Chelsea", "Tottenham", "Bayern Munich",
  "Borussia Dortmund", "Paris Saint-Germain", "Juventus", "Inter Milan",
  "AC Milan", "Napoli", "Atlético Madrid", "Bayer Leverkusen", "Atalanta",
  "PSV Eindhoven", "Ajax", "Benfica", "Porto", "Sporting CP", "Marseille",
  "RB Leipzig", "Newcastle United", "Aston Villa", "Al-Hilal", "Al Nassr",
];

const slugify = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// "[[Target|Display]]" / "[[Page]]" -> the displayed text.
function linkDisplay(s) {
  const m = s.match(/\[\[([^\]]+)\]\]/);
  if (!m) return s.replace(/[[\]]/g, "").trim();
  const parts = m[1].split("|");
  return parts[parts.length - 1].trim();
}

function ageAsOf(by, bm, bd) {
  let age = TOURNAMENT_START.y - by;
  if (TOURNAMENT_START.m < bm || (TOURNAMENT_START.m === bm && TOURNAMENT_START.d < bd)) age--;
  return age;
}

const raw = fs.readFileSync(SRC, "utf8");
const body = raw.slice(raw.indexOf("==Group A=="), raw.indexOf("==Statistics=="));
const lines = body.split(/\r?\n/);

const teams = [];
const players = [];
let group = null, team = null;

for (const line of lines) {
  const gm = line.match(/^==\s*Group\s+([A-L])\s*==/);
  if (gm) { group = gm[1]; continue; }

  const tm = line.match(/^===\s*([^=].*?)\s*===\s*$/);
  if (tm) {
    const name = tm[1].trim();
    const meta = TEAM_META[name];
    if (!meta) throw new Error(`No country metadata for team "${name}"`);
    const [iso2, fifa, confed] = meta;
    team = {
      id: slugify(name), name, group, confed, iso2, fifa,
      coach: null, coachNat: null, coachIso2: null, squadSize: 0,
    };
    teams.push(team);
    continue;
  }

  const cm = line.match(/^Coach:\s*(.+)$/);
  if (cm && team) {
    const flag = cm[1].match(/icon\|([A-Z]{3})/);
    team.coachNat = flag ? flag[1] : null;
    team.coachIso2 = flag ? (FIFA3_TO_ISO2[flag[1]] ?? null) : null;
    if (flag && !team.coachIso2) throw new Error(`No ISO for coach nationality ${flag[1]}`);
    team.coach = linkDisplay(cm[1]);
    continue;
  }

  if (line.includes("{{nat fs g player") && team) {
    const no = +(line.match(/\|\s*no\s*=\s*(\d+)/)?.[1] ?? 0);
    const pos = line.match(/\|\s*pos\s*=\s*([A-Za-z]{2})/)?.[1]?.toUpperCase() ?? null;
    const name = linkDisplay(line.match(/\|\s*name\s*=\s*(\[\[[^\]]+\]\][^|]*)/)?.[1] ?? "");
    const caps = +(line.match(/\|\s*caps\s*=\s*(\d+)/)?.[1] ?? 0);
    const goals = +(line.match(/\|\s*goals\s*=\s*(\d+)/)?.[1] ?? 0);
    const club = linkDisplay(line.match(/\|\s*club\s*=\s*(\[\[[^\]]+\]\])/)?.[1] ?? "");
    const clubNat = line.match(/clubnat\s*=\s*([A-Za-z]{3})/)?.[1]?.toUpperCase() ?? null;
    const isCaptain = /captain/i.test(line);
    const bd = line.match(/birth date and age2\s*\|\s*\d+\s*\|\s*\d+\s*\|\s*\d+\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)/);
    const dob = bd ? `${bd[1]}-${String(bd[2]).padStart(2, "0")}-${String(bd[3]).padStart(2, "0")}` : null;
    const age = bd ? ageAsOf(+bd[1], +bd[2], +bd[3]) : null;
    const elite = ELITE.some((e) => club.toLowerCase().includes(e.toLowerCase()));
    const fame = caps + 2 * goals + (elite ? 35 : 0);

    if (!name) throw new Error(`Player without a name in ${team.name}: ${line.slice(0, 80)}`);

    players.push({
      id: `${team.id}-${no}`, no, name, pos,
      team: team.name, teamId: team.id, group, confed: team.confed, iso2: team.iso2,
      club, clubNat, caps, goals, dob, age,
      captain: isCaptain || undefined, fame,
    });
    team.squadSize++;
  }
}

// Sort the pool by fame (most recognizable first) — drives Elo difficulty and
// the "Stars" filter; the array index is the fame rank.
players.sort((a, b) => b.fame - a.fame || a.name.localeCompare(b.name));

// League lookup (only codes that actually appear) -> { iso2, name }.
const leagues = {};
for (const p of players) {
  const code = p.clubNat;
  if (!code || leagues[code]) continue;
  if (!FIFA3_TO_ISO2[code] || !FIFA3_TO_NAME[code]) throw new Error(`No league mapping for clubnat=${code}`);
  leagues[code] = { iso2: FIFA3_TO_ISO2[code], name: FIFA3_TO_NAME[code] };
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "players.json"), JSON.stringify(players));
fs.writeFileSync(path.join(OUT, "teams.json"), JSON.stringify(teams));
fs.writeFileSync(path.join(OUT, "leagues.json"), JSON.stringify(leagues));

// --- validation / summary ---
const byConfed = {};
for (const t of teams) byConfed[t.confed] = (byConfed[t.confed] || 0) + 1;
const noPos = players.filter((p) => !p.pos).length;
const noClub = players.filter((p) => !p.club).length;
const noAge = players.filter((p) => p.age == null).length;

console.log(`teams:   ${teams.length}  (${Object.entries(byConfed).map(([k, v]) => `${k} ${v}`).join(", ")})`);
console.log(`players: ${players.length}  (squads ${Math.min(...teams.map((t) => t.squadSize))}-${Math.max(...teams.map((t) => t.squadSize))})`);
console.log(`clubs:   ${new Set(players.map((p) => p.club)).size}`);
console.log(`missing: pos ${noPos}, club ${noClub}, age ${noAge}`);
console.log(`top 5 by fame: ${players.slice(0, 5).map((p) => `${p.name} (${p.team}, ${p.fame})`).join("; ")}`);
console.log(`wrote public/players.json (${(fs.statSync(path.join(OUT, "players.json")).size / 1024).toFixed(0)} KB), public/teams.json`);
