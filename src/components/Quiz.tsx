"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Check, X, ArrowRight, Flame, Timer, Loader2, RotateCcw } from "lucide-react";
import {
  useData, POS_COLOR, POS_LABEL, CONFED_LABEL, type Pos, type Player, type Team,
} from "@/lib/data";
import {
  buildIndexes, buildPool, makeRound, modeByKey, categoryByKey, mulberry32, posLabel,
  type ModeKey, type Round,
} from "@/lib/quiz";
import { loadElo, saveElo, applyResult, defElo, type EloState } from "@/lib/elo";
import { load, save } from "@/lib/store";
import { Flag, preloadFlags } from "./Flag";
import { Jersey } from "./Jersey";
import { Sparkles, ThumbsDown } from "lucide-react";

// ----------------------------------------------------------------- reducer
type Phase = "idle" | "answered";
type QState = {
  current: Round | null;
  picked: string | null;
  phase: Phase;
  total: number;
  correct: number;
  streak: number;
  best: number;
  recentItems: string[];
  recentAnswers: string[];
  wrong: string[];         // item ids missed, newest first (Review queue)
};
type QAction =
  | { type: "load"; round: Round }
  | { type: "answer"; value: string }
  | { type: "next"; round: Round };

const INIT: QState = {
  current: null, picked: null, phase: "idle",
  total: 0, correct: 0, streak: 0, best: 0, recentItems: [], recentAnswers: [], wrong: [],
};

function reducer(s: QState, a: QAction): QState {
  switch (a.type) {
    case "load":
      // item types differ per mode, so the missed queue resets on mode/pool change
      return { ...s, current: a.round, picked: null, phase: "idle", wrong: [] };
    case "next":
      return { ...s, current: a.round, picked: null, phase: "idle" };
    case "answer": {
      if (s.phase !== "idle" || !s.current) return s;
      const id = s.current.itemId;
      const ok = a.value === s.current.correct;
      const streak = ok ? s.streak + 1 : 0;
      const wrong = ok
        ? s.wrong.filter((w) => w !== id)                       // got it right -> clear it
        : [id, ...s.wrong.filter((w) => w !== id)].slice(0, 30); // missed -> queue it
      return {
        ...s,
        picked: a.value, phase: "answered",
        total: s.total + 1, correct: s.correct + (ok ? 1 : 0),
        streak, best: Math.max(s.best, streak),
        recentItems: [id, ...s.recentItems].slice(0, 100),
        recentAnswers: [s.current.correct, ...s.recentAnswers].slice(0, 8),
        wrong,
      };
    }
  }
}

const AUTO_SEQ = [0, 1000, 3000, 5000];

// ----------------------------------------------------------------- component
export function Quiz({ modeKey, categoryKey }: { modeKey: ModeKey; categoryKey: string }) {
  const data = useData();
  const mode = modeByKey(modeKey);

  const idx = useMemo(() => (data ? buildIndexes(data) : null), [data]);
  const category = useMemo(() => categoryByKey(categoryKey), [categoryKey]);
  const pool = useMemo(
    () => (data && idx ? buildPool(data, category, idx) : []),
    [data, idx, category],
  );

  const [state, dispatch] = useReducer(reducer, INIT);
  const stateRef = useRef(state);
  stateRef.current = state;

  const rngRef = useRef<() => number>(mulberry32((Date.now() & 0x7fffffff) || 1));
  const serialRef = useRef(0);
  const eloRef = useRef<EloState>(defElo());
  const scoredRef = useRef<string | null>(null);
  const [delta, setDelta] = useState<number | null>(null);
  const [autoMs, setAutoMs] = useState(0);
  const [review, setReview] = useState(false);
  const [celebrate, setCelebrate] = useState(0);
  const reviewRef = useRef(review);
  reviewRef.current = review;
  const advancedRef = useRef<string | null>(null);

  const build = useCallback(
    (recentItems: string[], recentAnswers: string[], force?: Player | Team, asReview?: boolean): Round | null => {
      if (!data || !idx || pool.length === 0) return null;
      return makeRound({
        mode, pool, data, idx, category, rng: rngRef.current,
        recentItems, recentAnswers, serial: serialRef.current++, force, review: asReview,
      });
    },
    [data, idx, pool, mode, category],
  );

  // Load Elo + prefs once.
  useEffect(() => {
    eloRef.current = loadElo();
    setAutoMs(load<number>("f26.auto", 0));
    setReview(load<boolean>("f26.review", false));
  }, []);

  // Warm all national + league flags so flag-based modes feel instant.
  useEffect(() => {
    if (!data) return;
    preloadFlags(data.teams.map((t) => t.iso2));
    preloadFlags(Object.values(data.leagues).map((l) => l.iso2));
  }, [data]);

  // (Re)load a fresh round whenever the data, mode or category changes.
  useEffect(() => {
    const round = build([], []);
    if (round) dispatch({ type: "load", round });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, modeKey, categoryKey]);

  const onAnswer = useCallback((value: string) => dispatch({ type: "answer", value }), []);
  const onNext = useCallback(() => {
    const s = stateRef.current;
    // advance at most once per round (guards keyboard + auto-advance + click races)
    if (s.current && advancedRef.current === s.current.id) return;
    if (s.current) advancedRef.current = s.current.id;

    let force: Player | Team | undefined;
    let asReview = false;
    if (reviewRef.current && s.wrong.length && data && rngRef.current() < 0.45) {
      const id = s.wrong[Math.floor(rngRef.current() * Math.min(s.wrong.length, 6))];
      const item = mode.prompt === "player"
        ? data.players.find((p) => p.id === id)
        : data.teams.find((t) => t.id === id);
      if (item) { force = item; asReview = true; }
    }
    const round = build(s.recentItems, s.recentAnswers, force, asReview);
    if (round) { setDelta(null); dispatch({ type: "next", round }); }
  }, [build, data, mode]);

  const cycleReview = () => {
    const next = !review;
    setReview(next);
    save("f26.review", next);
  };

  // Score Elo exactly once per answered round.
  useEffect(() => {
    if (state.phase !== "answered" || !state.current) return;
    if (scoredRef.current === state.current.id) return;
    scoredRef.current = state.current.id;
    const won = state.picked === state.current.correct;
    const { next, delta: d } = applyResult(eloRef.current, won, state.current.difficulty);
    eloRef.current = next;
    saveElo(next);
    setDelta(d);
    window.dispatchEvent(new Event("f26-elo"));
  }, [state.phase, state.current, state.picked]);

  // Streak celebration at every 10.
  useEffect(() => {
    if (state.phase === "answered" && state.streak > 0 && state.streak % 10 === 0
        && state.picked === state.current?.correct) {
      setCelebrate(state.streak);
      const t = setTimeout(() => setCelebrate(0), 2200);
      return () => clearTimeout(t);
    }
  }, [state.streak, state.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance.
  useEffect(() => {
    if (state.phase === "answered" && autoMs > 0) {
      const t = setTimeout(onNext, autoMs);
      return () => clearTimeout(t);
    }
  }, [state.phase, state.current?.id, autoMs, onNext]);

  // Keyboard: 1–4 to answer, Enter/Space/→ to advance.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (document.body.dataset.picker) return; // a chooser modal is open
      const s = stateRef.current;
      if (!s.current) return;
      if (s.phase === "idle") {
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= s.current.choices.length) { e.preventDefault(); onAnswer(s.current.choices[n - 1].value); }
      } else if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onAnswer, onNext]);

  const cycleAuto = () => {
    const next = AUTO_SEQ[(AUTO_SEQ.indexOf(autoMs) + 1) % AUTO_SEQ.length];
    setAutoMs(next);
    save("f26.auto", next);
  };

  if (!data) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-ink-muted">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  const r = state.current;
  const answered = state.phase === "answered";
  const acc = state.total ? Math.round((state.correct / state.total) * 100) : 0;

  return (
    <section className="mx-auto max-w-5xl px-4 pb-10">
      <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
        {/* left: prompt + choices */}
        <div className="flex flex-1 flex-col gap-3">
          {r && <PromptCard r={r} />}
          {r && (
            <div className="grid grid-cols-1 gap-3 sm:auto-rows-fr sm:grid-cols-2">
              {r.choices.map((c, i) => (
                <ChoiceButton
                  key={c.value}
                  index={i + 1}
                  choice={c}
                  mode={r.mode}
                  choiceKind={r.choiceKind}
                  state={
                    !answered ? "idle"
                      : c.value === r.correct ? "good"
                      : c.value === state.picked ? "bad"
                      : "dim"
                  }
                  disabled={answered}
                  onPick={() => onAnswer(c.value)}
                />
              ))}
            </div>
          )}
        </div>

        {/* right: status / reveal */}
        <SidePanel
          r={r}
          answered={answered}
          won={state.picked === r?.correct}
          delta={delta}
          streak={state.streak}
          best={state.best}
          total={state.total}
          acc={acc}
        />
      </div>

      {/* controls */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={cycleAuto} className="pill-glass shrink-0 focus-ring" title="Auto-advance after answering">
          <Timer size={14} className="text-ink-muted" />
          {autoMs === 0 ? "Manual" : `Auto ${autoMs / 1000}s`}
        </button>
        <button
          onClick={cycleReview}
          className={`pill shrink-0 focus-ring ${review ? "pill-solid" : "pill-glass"}`}
          title="Resurface questions you missed"
        >
          <RotateCcw size={14} className={review ? "" : "text-ink-muted"} />
          Review{review && state.wrong.length ? ` ${state.wrong.length}` : ""}
        </button>
        <button
          onClick={onNext}
          disabled={!answered}
          className={`pill ml-auto shrink-0 focus-ring ${answered ? "pill-solid" : "pill-glass opacity-50"}`}
        >
          Next <ArrowRight size={15} />
        </button>
      </div>

      {celebrate > 0 && <Celebration streak={celebrate} />}
    </section>
  );
}

// ----------------------------------------------------------------- prompt
function PromptCard({ r }: { r: Round }) {
  return (
    <div className="glass-strong flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-[28px] px-6 py-8 text-center animate-pop md:min-h-[260px]">
      {r.review && (
        <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(217,119,6,0.12)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--amber)]">
          <RotateCcw size={11} strokeWidth={2.5} /> Review
        </span>
      )}
      <div className="label">{r.hint}</div>

      {r.prompt === "flag" && r.team && (
        <img
          src={`https://flagcdn.com/w320/${r.team.iso2}.png`}
          alt="Flag to identify"
          className="h-auto w-44 rounded-lg object-cover shadow-lg ring-1 ring-black/10 sm:w-56"
        />
      )}

      {r.prompt === "kit" && r.kit && <Jersey kit={r.kit} size={180} className="h-auto w-40 sm:w-48" />}

      {r.prompt === "team" && r.team && (
        <>
          <Flag iso2={r.team.iso2} className="h-16 rounded-md" w={160} />
          <div className="text-2xl font-bold leading-tight sm:text-3xl">{r.team.name}</div>
          <div className="text-sm text-ink-muted">{CONFED_LABEL[r.team.confed]}</div>
        </>
      )}

      {r.prompt === "player" && r.player && (
        <>
          <div className="text-3xl font-bold leading-tight sm:text-4xl">{r.player.name}</div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {/* show facts that don't give the answer away */}
            {r.mode !== "position" && r.player.pos && <PosChip pos={r.player.pos} />}
            {(r.mode === "club" || r.mode === "position") && (
              <Chip>
                <Flag iso2={r.player.iso2} className="h-4" />
                {r.player.team}
              </Chip>
            )}
            {(r.mode === "nation" || r.mode === "league" || r.mode === "position") && (
              <Chip>{r.player.club}</Chip>
            )}
            {r.mode === "league" && (
              <Chip>
                <Flag iso2={r.player.iso2} className="h-4" />
                {r.player.team}
              </Chip>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium text-ink/90">
      {children}
    </span>
  );
}

function PosChip({ pos }: { pos: Pos }) {
  return (
    <span className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium text-ink/90">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: POS_COLOR[pos] }} />
      {POS_LABEL[pos]}
    </span>
  );
}

// ----------------------------------------------------------------- choice
function ChoiceButton({
  index, choice, mode, choiceKind, state, disabled, onPick,
}: {
  index: number;
  choice: { value: string; iso2?: string };
  mode: ModeKey;
  choiceKind: "flag" | "text";
  state: "idle" | "good" | "bad" | "dim";
  disabled: boolean;
  onPick: () => void;
}) {
  const cls =
    state === "good" ? "ring-2 ring-green-600 bg-green-50"
      : state === "bad" ? "ring-2 ring-red-600 bg-red-50"
      : state === "dim" ? "glass opacity-45"
      : "glass hover:-translate-y-px";

  const label =
    choiceKind === "flag" ? choice.value
      : mode === "position" ? POS_LABEL[choice.value as Pos]
      : mode === "group" ? `Group ${choice.value}`
      : choice.value;

  return (
    <button
      onClick={onPick}
      disabled={disabled}
      className={`answer ${cls}`}
    >
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold text-ink-muted">
        {state === "good" ? <Check size={16} className="text-green-600" />
          : state === "bad" ? <X size={16} className="text-red-600" />
          : index}
      </span>
      {choiceKind === "flag" && choice.iso2 && <Flag iso2={choice.iso2} className="h-7" w={160} />}
      {choiceKind === "text" && mode === "position" && (
        <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: POS_COLOR[choice.value as Pos] }} />
      )}
      <span className="min-w-0 break-words font-medium leading-snug">{label}</span>
    </button>
  );
}

// ----------------------------------------------------------------- side panel
function SidePanel({
  r, answered, won, delta, streak, best, total, acc,
}: {
  r: Round | null;
  answered: boolean;
  won: boolean;
  delta: number | null;
  streak: number;
  best: number;
  total: number;
  acc: number;
}) {
  return (
    <aside className="glass-strong flex flex-col rounded-[28px] p-5 md:w-[300px] md:shrink-0">
      {!answered || !r ? (
        <div className="flex flex-1 flex-col">
          <div className="label">Question {total + 1}</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <MiniStat icon={<Flame size={14} className="text-[var(--amber)]" />} label="Streak" value={streak} />
            <MiniStat label="Best" value={best} />
            <MiniStat label="Answered" value={total} />
            <MiniStat label="Accuracy" value={`${acc}%`} />
          </div>
          <p className="mt-auto pt-4 text-sm text-ink-muted">
            Pick an answer — press <kbd className="font-sans font-semibold">1</kbd>–<kbd className="font-sans font-semibold">4</kbd>.
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col animate-fade-up">
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-2 text-lg font-bold ${won ? "text-green-600" : "text-red-600"}`}>
              {won ? <Check size={20} /> : <X size={20} />}
              {won ? "Correct" : "Not quite"}
            </div>
            {delta != null && (
              <span className={`text-sm font-semibold tabular-nums ${delta >= 0 ? "text-green-600" : "text-red-600"}`}>
                {delta >= 0 ? `+${delta}` : delta}
              </span>
            )}
          </div>

          <div className="mt-3 text-sm text-ink-muted">Answer</div>
          <div className="mt-1 text-xl font-bold leading-tight">
            <CorrectAnswer r={r} />
          </div>

          <p className="mt-3 text-sm leading-relaxed text-ink/80">{facts(r)}</p>

          {r.kit?.nrk && <NrkNote nrk={r.kit.nrk} />}

          <p className="mt-auto pt-3 text-sm text-ink-muted">
            <kbd className="font-sans font-semibold">Enter</kbd> or Next to continue.
          </p>
        </div>
      )}
    </aside>
  );
}

function MiniStat({ icon, label, value }: { icon?: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="glass rounded-2xl px-3 py-2">
      <div className="flex items-center gap-1 text-xl font-bold tabular-nums leading-none">
        {icon}
        {value}
      </div>
      <div className="label mt-1">{label}</div>
    </div>
  );
}

function CorrectAnswer({ r }: { r: Round }) {
  if (r.choiceKind === "flag") {
    const iso = r.choices.find((c) => c.value === r.correct)?.iso2;
    return (
      <span className="inline-flex items-center gap-2">
        {iso && <Flag iso2={iso} className="h-5" />}
        {r.correct}
      </span>
    );
  }
  if (r.mode === "position") return <>{posLabel(r.correct)}</>;
  if (r.mode === "group") return <>Group {r.correct}</>;
  return <>{r.correct}</>;
}

function facts(r: Round): string {
  if (r.team) {
    return `${r.team.name} — Group ${r.team.group} · ${CONFED_LABEL[r.team.confed]}`
      + (r.team.coach ? ` · Coach: ${r.team.coach}` : "");
  }
  const p = r.player!;
  const bits = [p.team, posLabel(p.pos), p.club, `${p.caps} caps`, `${p.goals} goals`];
  if (p.age) bits.push(`age ${p.age}`);
  return bits.join(" · ");
}

// NRK jury verdict — shown on reveal for the kits NRK ranked finest / ugliest.
function NrkNote({ nrk }: { nrk: NonNullable<Round["kit"]>["nrk"] }) {
  if (!nrk) return null;
  const best = nrk.kind === "best";
  return (
    <div
      className={`mt-3 rounded-2xl px-3 py-2 text-sm leading-relaxed ${
        best ? "bg-[rgba(22,163,74,0.1)] text-green-800" : "bg-[rgba(220,38,38,0.1)] text-red-800"
      }`}
    >
      <div className="flex items-center gap-1.5 font-semibold">
        {best ? <Sparkles size={14} /> : <ThumbsDown size={14} />}
        NRK: #{nrk.rank} {best ? "finest" : "ugliest"} kit
      </div>
      <p className="mt-1 text-ink/80">{nrk.note}</p>
    </div>
  );
}

// ----------------------------------------------------------------- celebration
function Celebration({ streak }: { streak: number }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center">
      <div className="frost animate-diploma rounded-3xl px-8 py-6 text-center">
        <Flame className="mx-auto text-[var(--amber)]" size={32} />
        <div className="mt-2 text-3xl font-bold tabular-nums">{streak} streak</div>
        <div className="text-sm text-ink-muted">on fire — keep going</div>
      </div>
    </div>
  );
}
