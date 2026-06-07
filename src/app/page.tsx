"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Quiz } from "@/components/Quiz";
import { load, save } from "@/lib/store";
import { modeByKey, type ModeKey } from "@/lib/quiz";

export default function Home() {
  const [modeKey, setModeKey] = useState<ModeKey>("nation");
  const [categoryKey, setCategoryKey] = useState("all");

  // Restore last-used mode/pool after mount (SSR-safe; defaults match first render).
  useEffect(() => {
    setModeKey(modeByKey(load<ModeKey>("f26.mode", "nation")).key);
    setCategoryKey(load<string>("f26.cat", "all"));
  }, []);

  const onMode = (k: ModeKey) => { setModeKey(k); save("f26.mode", k); };
  const onCat = (k: string) => { setCategoryKey(k); save("f26.cat", k); };

  return (
    <main className="min-h-dvh pb-10">
      <Header page="quiz" modeKey={modeKey} categoryKey={categoryKey} onModeKey={onMode} onCategoryKey={onCat} />
      <Quiz modeKey={modeKey} categoryKey={categoryKey} />
    </main>
  );
}
