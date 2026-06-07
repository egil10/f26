"use client";

import { Header } from "@/components/Header";
import { SquadBrowser } from "@/components/SquadBrowser";

export default function Study() {
  return (
    <main className="min-h-dvh pb-10">
      <Header page="study" />
      <div className="mx-auto max-w-5xl px-4 pb-4 pt-1">
        <h1 className="text-2xl font-bold leading-tight">Squad browser</h1>
        <p className="mt-1 text-sm text-ink-muted">
          All 48 teams · 1,244 players · the full 2026 World Cup field. Tap a team to study its 26-man squad.
        </p>
      </div>
      <SquadBrowser />
    </main>
  );
}
