import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";

// One display face for the wordmark only; body stays on the system sans stack.
const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: "World Cup 26 — Squad Quiz",
  description:
    "Learn every squad of the 2026 FIFA World Cup. Guess players' nations, clubs, positions, groups and flags across all 48 teams.",
  applicationName: "World Cup 26 Squad Quiz",
  keywords: ["World Cup 2026", "FIFA", "squads", "quiz", "football", "soccer"],
};

export const viewport: Viewport = {
  themeColor: "#fafaf7",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`min-h-dvh antialiased font-sans ${display.variable}`}>
        {children}
        <footer className="mx-auto max-w-5xl px-4 py-8 text-center text-[12px] leading-relaxed text-ink-muted">
          Squad data from{" "}
          <a className="underline decoration-ink-muted/40 underline-offset-2 hover:text-ink" href="https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads" target="_blank" rel="noreferrer">
            Wikipedia
          </a>{" "}
          (CC BY-SA) · flags by{" "}
          <a className="underline decoration-ink-muted/40 underline-offset-2 hover:text-ink" href="https://flagcdn.com" target="_blank" rel="noreferrer">
            flagcdn
          </a>
          . Ages as of June 11, 2026. Unofficial fan project — not affiliated with FIFA.
        </footer>
      </body>
    </html>
  );
}
