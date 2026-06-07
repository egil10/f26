// Two-tone lowercase wordmark in the display face. A plain <a href="/"> so a
// click is a hard reload = clean reset (BLUEPRINT §3.4).
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <a
      href="/"
      aria-label="squad26 — home"
      className={`font-display text-lg font-bold leading-none tracking-tight ${className}`}
    >
      <span className="text-ink">squad</span>
      <span className="text-ink-muted">26</span>
    </a>
  );
}
