"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, Library, Gamepad2 } from "lucide-react";
import { Wordmark } from "./Wordmark";
import { EloBadge } from "./EloBadge";
import { Picker, type PickerGroup } from "./Picker";
import { MODES, CATEGORIES, modeByKey, categoryByKey, type ModeKey } from "@/lib/quiz";

const CAT_ORDER = ["Pool", "Confederation", "Group"];

// Toolbar: a row of frosted pills over scrolling content, no solid bar. On the
// quiz page it carries the mode + pool choosers; on study it's just nav + rating.
export function Header({
  page, modeKey, categoryKey, onModeKey, onCategoryKey,
}: {
  page: "quiz" | "study";
  modeKey?: ModeKey;
  categoryKey?: string;
  onModeKey?: (k: ModeKey) => void;
  onCategoryKey?: (k: string) => void;
}) {
  const [picker, setPicker] = useState<null | "mode" | "category">(null);
  const showControls = page === "quiz" && modeKey && categoryKey && onModeKey && onCategoryKey;

  const modeGroups: PickerGroup[] = [
    { label: "Game mode", options: MODES.map((m) => ({ key: m.key, label: m.label, hint: m.hint })) },
  ];
  const catGroups: PickerGroup[] = CAT_ORDER.map((g) => ({
    label: g,
    options: CATEGORIES.filter((c) => c.group === g).map((c) => ({ key: c.key, label: c.label })),
  }));

  return (
    <header className="sticky top-0 z-30">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <div className="no-scrollbar -my-1 flex flex-1 items-center gap-2 overflow-x-auto py-1">
          <Wordmark className="mr-1 shrink-0" />
          {showControls && (
            <>
              <button className="pill-glass shrink-0 focus-ring" onClick={() => setPicker("mode")}>
                <span className="text-ink-muted">Mode</span>
                <span className="font-semibold">{modeByKey(modeKey!).label}</span>
                <ChevronDown size={14} className="text-ink-muted" />
              </button>
              <button className="pill-glass shrink-0 focus-ring" onClick={() => setPicker("category")}>
                <span className="text-ink-muted">Pool</span>
                <span className="font-semibold">{categoryByKey(categoryKey!).label}</span>
                <ChevronDown size={14} className="text-ink-muted" />
              </button>
            </>
          )}
        </div>

        <nav className="flex shrink-0 items-center gap-2">
          {page === "quiz" ? (
            <Link href="/study" className="pill-ghost focus-ring">
              <Library size={15} />
              <span className="hidden sm:inline">Study</span>
            </Link>
          ) : (
            <Link href="/" className="pill-ghost focus-ring">
              <Gamepad2 size={15} />
              <span className="hidden sm:inline">Play</span>
            </Link>
          )}
          <EloBadge />
        </nav>
      </div>

      {showControls && (
        <>
          <Picker
            open={picker === "mode"} title="Choose a game mode" cards groups={modeGroups}
            current={modeKey!} onPick={(k) => onModeKey!(k as ModeKey)} onClose={() => setPicker(null)}
          />
          <Picker
            open={picker === "category"} title="Filter the player pool" groups={catGroups}
            current={categoryKey!} onPick={(k) => onCategoryKey!(k)} onClose={() => setPicker(null)}
          />
        </>
      )}
    </header>
  );
}
