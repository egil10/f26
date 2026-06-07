"use client";

// SSR-safe, versioned localStorage helpers. For objects, defaults are merged in
// so an older stored blob missing new keys still works (BLUEPRINT §9).

export function load<T>(key: string, def: T): T {
  if (typeof window === "undefined") return def;
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return def;
    const parsed = JSON.parse(raw);
    if (def && typeof def === "object" && parsed && typeof parsed === "object" && !Array.isArray(def)) {
      return { ...def, ...parsed };
    }
    return parsed ?? def;
  } catch {
    return def;
  }
}

export function save<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / private-mode errors */
  }
}
