// Mini-stat compatta per l'interno di una DashboardCard (§6.1) — come
// StatTile ma senza il proprio bordo/sfondo, per stare 2x2 dentro una
// singola card invece che ognuna nella propria.
export function MiniStat({
  label,
  value,
  hint,
  tone = "neutral",
  wide = false,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "good" | "critical";
  wide?: boolean;
}) {
  const toneClass =
    tone === "good" ? "text-status-good" : tone === "critical" ? "text-status-critical" : "text-ink-primary";
  return (
    <div className={`flex flex-col gap-0.5 ${wide ? "col-span-2" : ""}`}>
      <span className="text-xs text-ink-secondary">{label}</span>
      <span className={`text-lg font-semibold [font-variant-numeric:tabular-nums] ${toneClass}`}>{value}</span>
      {hint && <span className="text-[11px] text-ink-muted">{hint}</span>}
    </div>
  );
}

export function MiniStatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}
