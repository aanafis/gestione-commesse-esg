// Barre orizzontali riusabili per il Cruscotto (§6.1) — vedi skill dataviz,
// marks-and-anatomy.md: barre sottili, estremità arrotondate, ancorate a
// una baseline. La baseline è lo zero del dominio, non il bordo sinistro:
// un valore negativo (es. margine sotto zero) deve poter crescere verso
// sinistra invece di essere troncato a 0 come farebbe una barra "normale".
export type BarRow = {
  key: string;
  label: string;
  value: number;
  displayValue: string;
  colorClass: string; // classe Tailwind es. "bg-status-good"
};

export function HorizontalBars({ rows }: { rows: BarRow[] }) {
  const values = rows.map((r) => r.value);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const zeroPct = ((0 - min) / span) * 100;
  const showZeroLine = min < 0 && max > 0;

  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r) => {
        const valuePct = ((r.value - min) / span) * 100;
        const left = Math.min(zeroPct, valuePct);
        const width = Math.max(Math.abs(valuePct - zeroPct), 1.5);
        return (
          <div key={r.key} className="grid grid-cols-[minmax(0,112px)_1fr_60px] items-center gap-2.5">
            <span className="truncate text-[12.5px] text-ink-secondary" title={r.label}>
              {r.label}
            </span>
            <div className="relative h-2.5 overflow-hidden rounded-full border border-gridline bg-page">
              {showZeroLine && (
                <div
                  className="absolute -top-px -bottom-px w-px bg-ink-muted/40"
                  style={{ left: `${zeroPct}%` }}
                />
              )}
              <div
                className={`absolute inset-y-0 rounded-full ${r.colorClass}`}
                style={{ left: `${left}%`, width: `${width}%` }}
              />
            </div>
            <span className="text-right text-[12.5px] font-semibold text-ink-primary [font-variant-numeric:tabular-nums]">
              {r.displayValue}
            </span>
          </div>
        );
      })}
    </div>
  );
}
