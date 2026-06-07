"use client";

import { flagUrl, flagSrcSet } from "@/lib/data";

// A flag chip. flagcdn PNGs are 4:3, so we lock the box to aspect-[4/3] and let
// the caller set only the height — nothing gets cropped. `w` is the fetch
// resolution (retina), independent of display size.
export function Flag({
  iso2,
  className = "h-5",
  w = 80,
}: {
  iso2: string;
  className?: string;
  w?: 40 | 80 | 160;
}) {
  return (
    <img
      alt=""
      aria-hidden
      src={flagUrl(iso2, w)}
      srcSet={flagSrcSet(iso2, w === 160 ? 160 : w === 40 ? 40 : 80)}
      className={`inline-block aspect-[4/3] w-auto shrink-0 rounded-[3px] object-cover ring-1 ring-black/10 ${className}`}
    />
  );
}

// Warm the browser cache for flags about to appear (keeps choices from popping in).
export function preloadFlags(iso2s: string[]) {
  if (typeof window === "undefined") return;
  for (const c of iso2s) {
    const img = new window.Image();
    img.src = flagUrl(c, 80);
  }
}
