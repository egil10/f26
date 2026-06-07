"use client";

import { useEffect, useState } from "react";
import { Trophy, Anchor, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { loadElo, eloStatus, type EloState, type EloStatus } from "@/lib/elo";

const ICON: Record<EloStatus, typeof Minus> = {
  peak: Trophy, low: Anchor, up: TrendingUp, down: TrendingDown, steady: Minus,
};
const COLOR: Record<EloStatus, string> = {
  peak: "text-[var(--amber)]", low: "text-ink-muted",
  up: "text-[var(--good)]", down: "text-[var(--bad)]", steady: "text-ink-muted",
};

// Rating badge. Reads from storage and re-reads on the "f26-elo" event the quiz
// fires after scoring (so no prop-drilling across pages). The +/- change is shown
// in the quiz reveal, not here (BLUEPRINT §8).
export function EloBadge() {
  const [elo, setElo] = useState<EloState | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const reload = () => setElo(loadElo());
    reload();
    window.addEventListener("f26-elo", reload);
    return () => window.removeEventListener("f26-elo", reload);
  }, []);

  if (!elo) return <div className="pill-glass tabular-nums opacity-0">0000</div>;

  const status = eloStatus(elo);
  const Icon = ICON[status];
  const acc = elo.games ? Math.round((elo.wins / elo.games) * 100) : 0;

  return (
    <div className="relative shrink-0">
      <button onClick={() => setOpen((o) => !o)} className="pill-glass focus-ring" title="Your rating">
        <Icon size={14} strokeWidth={2.2} className={COLOR[status]} />
        <span className="font-semibold tabular-nums">{elo.rating}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="frost absolute right-0 z-50 mt-2 w-72 rounded-2xl p-4 animate-fade-up">
            <div className="flex items-end justify-between">
              <div>
                <div className="label">Rating</div>
                <div className="text-3xl font-bold tabular-nums leading-none">{elo.rating}</div>
              </div>
              <div className="flex items-center gap-1 text-sm text-ink-muted">
                <Icon size={15} strokeWidth={2.2} className={COLOR[status]} />
                {status === "peak" ? "all-time high" : status === "low" ? "all-time low" : status}
              </div>
            </div>

            <Spark history={elo.history} />

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Stat label="Peak" value={elo.peak} />
              <Stat label="Games" value={elo.games} />
              <Stat label="Accuracy" value={`${acc}%`} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="glass rounded-xl py-2">
      <div className="text-base font-semibold tabular-nums leading-none">{value}</div>
      <div className="label mt-1">{label}</div>
    </div>
  );
}

// Inline SVG sparkline of rating history, coloured by net direction.
function Spark({ history }: { history: number[] }) {
  const data = history.slice(-80);
  if (data.length < 2) return <div className="mt-3 h-12" />;
  const w = 240, h = 48, pad = 2;
  const min = Math.min(...data), max = Math.max(...data);
  const span = Math.max(1, max - min);
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / span) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const up = data[data.length - 1] >= data[0];
  const color = up ? "var(--good)" : "var(--bad)";
  return (
    <svg className="mt-3 w-full" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
