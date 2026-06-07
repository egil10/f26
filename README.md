# squad26 — World Cup 2026 Squad Quiz

An endless, multiple-choice quiz for learning every squad of the **2026 FIFA World
Cup** — all 48 teams, 1,244 players, their clubs, positions, groups and flags.
Built to make the whole tournament field stick.

Live: pushed to Vercel (auto-deploys from `main`).

## Game modes

Pick a mode and a pool (all players, "stars", a confederation, or a single group),
then answer with the keyboard (`1`–`4`, `Enter`/`→` for next) or by tapping:

| Mode | Prompt | Guess |
|------|--------|-------|
| **Nation** | a player (+ club, position) | which national team — pick the flag |
| **Club** | a player (+ nation, position) | which club |
| **Position** | a player (+ nation, club) | GK / DF / MF / FW |
| **League** | a player (+ club) | which country their club plays in |
| **Group** | a team | which group (A–L) it's drawn in |
| **Flag** | a flag | which country |

A per-device **Elo rating** treats each question as a match — obscure players are
tougher opponents — and tracks streaks, accuracy and a rating history sparkline.
Everything persists in `localStorage`; no backend.

## Study mode

`/study` is a browser for the full field: all 48 squads grouped by draw group,
searchable by player / club / team, with each team's 26-man squad split by
position (number, age, caps, goals, club + league flag, captain).

## Tech

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS · lucide-react.
A statically-served client app — the dataset is JSON in `public/`, cached
immutably and busted with `?v=`. Flags from [flagcdn](https://flagcdn.com).
Design system reused from the `artguessr` blueprint (glass + warm paper + pills).

```
src/
  app/        layout, globals.css (design system), page.tsx (quiz), study/page.tsx
  components/ Quiz, SquadBrowser, Header, Picker, EloBadge, Flag, Wordmark
  lib/        data (types + fetch hook), quiz (modes/categories/engine), elo, store
scripts/      fetch-squads + parse-squads (Wikipedia wikitext -> public/*.json)
public/       players.json, teams.json, leagues.json
```

## Develop

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build (also type-checks)
```

## Refresh the data

Squad data is parsed from the Wikipedia article. To regenerate:

```bash
npm run data         # fetch wikitext -> data-raw/, then parse -> public/*.json
```

then bump `DATA_VERSION` in `src/lib/data.ts` so the immutable cache misses.
Sanity-check the engine over the new data with `npx tsx scripts/engine-check.mts`.

## Credits

Squad data from [Wikipedia](https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads)
(CC BY-SA). Flags by flagcdn. Unofficial fan project — not affiliated with FIFA.
Ages are as of June 11, 2026 (the opening match).
