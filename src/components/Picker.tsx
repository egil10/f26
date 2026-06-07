"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { Flag } from "./Flag";

export type PickerOption = { key: string; label: string; hint?: string; iso2?: string };
export type PickerGroup = { label: string; options: PickerOption[] };

// A full-screen frosted chooser (BLUEPRINT §3.4). `cards` renders options as
// labelled tiles (used for modes); otherwise compact pills (used for filters).
export function Picker({
  open, title, groups, current, cards, onPick, onClose,
}: {
  open: boolean;
  title: string;
  groups: PickerGroup[];
  current: string;
  cards?: boolean;
  onPick: (key: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    document.body.dataset.picker = "1"; // lets the quiz suppress its 1–4 hotkeys
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      delete document.body.dataset.picker;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 animate-fade-in">
      <div className="absolute inset-0 frost-backdrop" onClick={onClose} />
      <div className="frost relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl p-5 animate-pop sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full hover:bg-black/5 focus-ring"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        {groups.map((g) => (
          <div key={g.label} className="mb-5 last:mb-0">
            <div className="label mb-2">{g.label}</div>
            {cards ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {g.options.map((o) => {
                  const active = o.key === current;
                  return (
                    <button
                      key={o.key}
                      onClick={() => { onPick(o.key); onClose(); }}
                      className={`rounded-2xl p-3 text-left transition focus-ring ${
                        active ? "bg-black text-white" : "glass hover:-translate-y-px"
                      }`}
                    >
                      <div className="font-medium">{o.label}</div>
                      {o.hint && (
                        <div className={`mt-0.5 text-[12px] ${active ? "text-white/70" : "text-ink-muted"}`}>
                          {o.hint}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {g.options.map((o) => {
                  const active = o.key === current;
                  return (
                    <button
                      key={o.key}
                      onClick={() => { onPick(o.key); onClose(); }}
                      className={`pill focus-ring ${active ? "pill-solid" : "pill-glass"}`}
                    >
                      {o.iso2 && <Flag iso2={o.iso2} className="h-4 w-6" />}
                      {o.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
