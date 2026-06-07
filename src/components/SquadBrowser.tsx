"use client";

import { useMemo, useState } from "react";
import { Search, ChevronLeft, Loader2 } from "lucide-react";
import {
  useData, POS_COLOR, POS_LABEL, POSITIONS, CONFED_LABEL, GROUPS,
  type Player, type Team, type Pos, type Data,
} from "@/lib/data";
import { Flag } from "./Flag";

export function SquadBrowser() {
  const data = useData();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);

  const byTeam = useMemo(() => {
    const m = new Map<string, Player[]>();
    if (data) for (const p of data.players) {
      const arr = m.get(p.teamId);
      if (arr) arr.push(p);
      else m.set(p.teamId, [p]);
    }
    return m;
  }, [data]);

  if (!data) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-ink-muted">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const team = selected ? data.teams.find((t) => t.id === selected) ?? null : null;

  return (
    <section className="mx-auto max-w-5xl px-4 pb-12">
      {/* search + filters */}
      <div className="mb-4 flex flex-col gap-3">
        <div className="glass flex items-center gap-2 rounded-full px-4 py-2.5">
          <Search size={16} className="text-ink-muted" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
            placeholder="Search 1,244 players, clubs, teams…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-ink-muted"
          />
        </div>
        {!q && (
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
            <FilterPill active={group === "all"} onClick={() => setGroup("all")}>All groups</FilterPill>
            {GROUPS.map((g) => (
              <FilterPill key={g} active={group === g} onClick={() => setGroup(g)}>Group {g}</FilterPill>
            ))}
          </div>
        )}
      </div>

      {q ? (
        <SearchResults data={data} q={q} onOpenTeam={(id) => { setSelected(id); setQuery(""); }} />
      ) : team ? (
        <TeamDetail team={team} players={byTeam.get(team.id) ?? []} data={data} onBack={() => setSelected(null)} />
      ) : (
        <TeamGrid
          teams={data.teams.filter((t) => group === "all" || t.group === group)}
          onOpen={setSelected}
        />
      )}
    </section>
  );
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`pill shrink-0 focus-ring ${active ? "pill-solid" : "pill-glass"}`}>
      {children}
    </button>
  );
}

// ----------------------------------------------------------------- team grid
function TeamGrid({ teams, onOpen }: { teams: Team[]; onOpen: (id: string) => void }) {
  const groups = GROUPS.filter((g) => teams.some((t) => t.group === g));
  return (
    <div className="flex flex-col gap-6">
      {groups.map((g) => (
        <div key={g}>
          <div className="label mb-2">Group {g}</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {teams.filter((t) => t.group === g).map((t) => (
              <button
                key={t.id}
                onClick={() => onOpen(t.id)}
                className="glass flex flex-col gap-2 rounded-2xl p-3 text-left transition hover:-translate-y-px focus-ring"
              >
                <Flag iso2={t.iso2} className="h-12 rounded-md" w={160} />
                <div className="font-semibold leading-tight">{t.name}</div>
                <div className="text-[12px] text-ink-muted">
                  {CONFED_LABEL[t.confed]} · {t.squadSize} players
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------- team detail
function TeamDetail({ team, players, data, onBack }: { team: Team; players: Player[]; data: Data; onBack: () => void }) {
  return (
    <div className="animate-fade-up">
      <button onClick={onBack} className="pill-ghost focus-ring mb-3 -ml-2">
        <ChevronLeft size={16} /> All teams
      </button>

      <div className="glass-strong mb-4 flex items-center gap-4 rounded-[28px] p-5">
        <Flag iso2={team.iso2} className="h-16 rounded-md" w={160} />
        <div>
          <h1 className="text-2xl font-bold leading-tight">{team.name}</h1>
          <div className="mt-1 text-sm text-ink-muted">
            Group {team.group} · {CONFED_LABEL[team.confed]} · {team.squadSize} players
          </div>
          {team.coach && (
            <div className="mt-1 flex items-center gap-1.5 text-sm text-ink/80">
              Coach: {team.coachIso2 && <Flag iso2={team.coachIso2} className="h-3.5" />}
              {team.coach}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {POSITIONS.map((pos) => {
          const group = players.filter((p) => p.pos === pos).sort((a, b) => a.no - b.no);
          if (!group.length) return null;
          return (
            <div key={pos}>
              <div className="label mb-1 flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: POS_COLOR[pos] }} />
                {POS_LABEL[pos]}s
              </div>
              <div className="glass overflow-hidden rounded-2xl">
                {group.map((p) => (
                  <PlayerRow key={p.id} p={p} data={data} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlayerRow({ p, data }: { p: Player; data: Data }) {
  const league = p.clubNat ? data.leagues[p.clubNat] : null;
  return (
    <div className="flex items-center gap-3 border-b border-black/5 px-3 py-2.5 last:border-0">
      <span className="w-6 shrink-0 text-center text-sm tabular-nums text-ink-muted">{p.no}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium">{p.name}</span>
          {p.captain && (
            <span className="inline-grid h-4 w-4 shrink-0 place-items-center rounded-full bg-ink text-[9px] font-bold text-white" title="Captain">C</span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-muted">
          {league && <Flag iso2={league.iso2} className="h-3" />}
          <span className="truncate">{p.club}</span>
        </div>
      </div>
      <div className="shrink-0 text-right text-sm tabular-nums text-ink-muted">
        <div>{p.caps}c · {p.goals}g</div>
        {p.age != null && <div className="text-[11px]">age {p.age}</div>}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------- search
function SearchResults({ data, q, onOpenTeam }: { data: Data; q: string; onOpenTeam: (id: string) => void }) {
  const players = data.players
    .filter((p) => p.name.toLowerCase().includes(q) || p.club.toLowerCase().includes(q) || p.team.toLowerCase().includes(q))
    .slice(0, 80);

  if (!players.length) {
    return <p className="py-12 text-center text-ink-muted">No players, clubs or teams match “{q}”.</p>;
  }

  return (
    <div className="glass overflow-hidden rounded-2xl">
      {players.map((p) => {
        const league = p.clubNat ? data.leagues[p.clubNat] : null;
        return (
          <button
            key={p.id}
            onClick={() => onOpenTeam(p.teamId)}
            className="flex w-full items-center gap-3 border-b border-black/5 px-3 py-2.5 text-left transition last:border-0 hover:bg-black/[0.03] focus-ring"
          >
            <Flag iso2={p.iso2} className="h-6" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{p.name}</span>
                <span className="shrink-0 text-[12px] text-ink-muted">{POS_LABEL[p.pos as Pos] ?? ""}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-muted">
                <span className="shrink-0">{p.team}</span>
                <span className="opacity-40">·</span>
                {league && <Flag iso2={league.iso2} className="h-3" />}
                <span className="truncate">{p.club}</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
