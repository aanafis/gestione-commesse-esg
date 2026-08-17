// Stat tile: label (minuscolo, senza due punti) + value (sans, proporzionale,
// mai tabular-nums qui) + hint opzionale. Vedi skill dataviz,
// references/marks-and-anatomy.md § Figures.

export function StatTile({
  label,
  value,
  hint,
  emphasis = false,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4">
      <span className="text-sm text-ink-secondary">{label}</span>
      <span
        className={
          emphasis
            ? "text-3xl font-semibold text-ink-primary"
            : "text-xl font-semibold text-ink-primary"
        }
      >
        {value}
      </span>
      {hint && <span className="text-xs text-ink-muted">{hint}</span>}
    </div>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {children}
      </div>
    </section>
  );
}
