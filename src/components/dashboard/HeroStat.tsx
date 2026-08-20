// I pochi numeri che contano di più (§6.1) — più grandi delle StatTile
// normali, riga unica in cima al Cruscotto invece che mescolati con tutto
// il resto. Vedi skill dataviz, references/marks-and-anatomy.md § Figures.
export function HeroStat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "critical";
}) {
  return (
    <div className="card-shadow flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-5">
      <span className="text-sm text-ink-secondary">{label}</span>
      <span
        className={`text-3xl font-semibold leading-tight [font-variant-numeric:tabular-nums] ${
          tone === "critical" ? "text-status-critical" : "text-ink-primary"
        }`}
      >
        {value}
      </span>
      {hint && <span className="text-xs text-ink-muted">{hint}</span>}
    </div>
  );
}
