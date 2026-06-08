import type { Kit, KitPattern } from "@/lib/data";

// A stylised football shirt rendered purely from kit colours — no external
// assets, so it paints instantly. Sleeves use the secondary colour, the collar
// the accent, and the body carries the team's pattern (stripes/hoops/etc.).
const BODY =
  "M40 10 Q50 20 60 10 L70 10 L74 40 L74 96 L26 96 L26 40 L30 10 Z";
const SLEEVE_L = "M30 10 L26 40 L14 46 L6 24 Z";
const SLEEVE_R = "M70 10 L74 40 L86 46 L94 24 Z";

function Pattern({ pattern, primary, secondary }: { pattern: KitPattern; primary: string; secondary: string }) {
  switch (pattern) {
    case "stripes":
      return (
        <>
          {[28, 40, 52, 64].map((x) => (
            <rect key={x} x={x} y={0} width={6} height={100} fill={secondary} />
          ))}
        </>
      );
    case "hoops":
      return (
        <>
          {[24, 44, 64, 84].map((y) => (
            <rect key={y} x={0} y={y} width={100} height={9} fill={secondary} />
          ))}
        </>
      );
    case "halves":
      return <rect x={50} y={0} width={50} height={100} fill={secondary} />;
    case "checkers":
      return (
        <>
          {Array.from({ length: 6 }).flatMap((_, r) =>
            Array.from({ length: 6 }).map((_, c) =>
              (r + c) % 2 === 0 ? (
                <rect key={`${r}-${c}`} x={20 + c * 10} y={6 + r * 16} width={10} height={16} fill={secondary} />
              ) : null,
            ),
          )}
        </>
      );
    default:
      return null;
  }
}

export function Jersey({ kit, className = "", size = 160 }: { kit: Kit; className?: string; size?: number }) {
  const { primary, secondary, accent, pattern } = kit;
  const clipId = `jersey-body-${primary}-${pattern}`.replace(/[^a-z0-9-]/gi, "");
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label="Football kit to identify"
      className={`drop-shadow-md ${className}`}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={BODY} />
        </clipPath>
      </defs>

      {/* sleeves */}
      <path d={SLEEVE_L} fill={secondary} stroke="rgba(0,0,0,0.18)" strokeWidth={0.8} />
      <path d={SLEEVE_R} fill={secondary} stroke="rgba(0,0,0,0.18)" strokeWidth={0.8} />

      {/* body base + pattern (clipped to the torso) */}
      <path d={BODY} fill={primary} />
      <g clipPath={`url(#${clipId})`}>
        <Pattern pattern={pattern} primary={primary} secondary={secondary} />
      </g>
      <path d={BODY} fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth={0.8} />

      {/* collar */}
      <path d="M40 10 Q50 20 60 10 L57 8 Q50 16 43 8 Z" fill={accent} />
    </svg>
  );
}
