"use client";

import { useEffect, useState } from "react";

// Bump when public/*.json is regenerated so the immutable cache misses (BLUEPRINT §6).
export const DATA_VERSION = 1;

export type Pos = "GK" | "DF" | "MF" | "FW";

export type Player = {
  id: string;
  no: number;
  name: string;
  pos: Pos | null;
  team: string;
  teamId: string;
  group: string;
  confed: Confed;
  iso2: string;       // national flag (flagcdn code)
  club: string;
  clubNat: string | null; // FIFA-3 league code, key into leagues.json
  caps: number;
  goals: number;
  dob: string | null;
  age: number | null;
  captain?: boolean;
  fame: number;
};

export type Team = {
  id: string;
  name: string;
  group: string;
  confed: Confed;
  iso2: string;
  fifa: string;
  coach: string | null;
  coachNat: string | null;
  coachIso2: string | null;
  squadSize: number;
};

export type League = { iso2: string; name: string };
export type Leagues = Record<string, League>;

export type Confed = "UEFA" | "CONMEBOL" | "CONCACAF" | "CAF" | "AFC" | "OFC";

export const POSITIONS: Pos[] = ["GK", "DF", "MF", "FW"];
export const POS_LABEL: Record<Pos, string> = {
  GK: "Goalkeeper", DF: "Defender", MF: "Midfielder", FW: "Forward",
};
export const POS_COLOR: Record<Pos, string> = {
  GK: "#d97706", DF: "#2563eb", MF: "#16a34a", FW: "#dc2626",
};

export const GROUPS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

export const CONFEDS: Confed[] = ["UEFA", "CONMEBOL", "CONCACAF", "CAF", "AFC", "OFC"];
export const CONFED_LABEL: Record<Confed, string> = {
  UEFA: "Europe", CONMEBOL: "South America", CONCACAF: "North America",
  CAF: "Africa", AFC: "Asia", OFC: "Oceania",
};

// flagcdn serves 4:3 PNGs at fixed widths. w40/w80 for chips, w160/w320 for prompts.
export const flagUrl = (iso2: string, w: 40 | 80 | 160 | 320 | 640 = 80) =>
  `https://flagcdn.com/w${w}/${iso2.toLowerCase()}.png`;

export const flagSrcSet = (iso2: string, w: 40 | 80 | 160 = 80) =>
  `${flagUrl(iso2, w)} 1x, ${flagUrl(iso2, (w * 2) as 80 | 160 | 320)} 2x`;

// ---- dataset loading: module-level cache so route changes don't refetch ----

export type Data = { players: Player[]; teams: Team[]; leagues: Leagues };

let cache: Data | null = null;
let inflight: Promise<Data> | null = null;

async function loadData(): Promise<Data> {
  if (cache) return cache;
  if (inflight) return inflight;
  const v = `?v=${DATA_VERSION}`;
  inflight = (async () => {
    const [players, teams, leagues] = await Promise.all([
      fetch(`/players.json${v}`, { cache: "force-cache" }).then((r) => r.json()),
      fetch(`/teams.json${v}`, { cache: "force-cache" }).then((r) => r.json()),
      fetch(`/leagues.json${v}`, { cache: "force-cache" }).then((r) => r.json()),
    ]);
    cache = { players, teams, leagues };
    return cache;
  })();
  return inflight;
}

export function useData(): Data | null {
  const [data, setData] = useState<Data | null>(cache);
  useEffect(() => {
    if (cache) { setData(cache); return; }
    let alive = true;
    loadData().then((d) => { if (alive) setData(d); });
    return () => { alive = false; };
  }, []);
  return data;
}
