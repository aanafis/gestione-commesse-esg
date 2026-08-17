// Riga di una "composizione" economica (costo → markup → prezzo → sconto →
// margine, §6.3 Scheda servizio). Non è un grafico: è un piccolo prospetto
// verticale, l'operatore (×, +, =, −) rende esplicito come si arriva al
// numero successivo.

export function BreakdownRow({
  label,
  value,
  op,
  emphasis = false,
  hint,
}: {
  label: string;
  value: string;
  op?: "×" | "+" | "=" | "−";
  emphasis?: boolean;
  hint?: string;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-1.5 ${
        emphasis ? "mt-1 border-t border-gridline pt-2 font-semibold text-ink-primary" : ""
      }`}
    >
      <span className={`text-sm ${emphasis ? "" : "text-ink-secondary"}`}>
        {op && <span className="mr-1.5 inline-block w-2 text-ink-muted">{op}</span>}
        {label}
        {hint && <span className="block text-xs font-normal text-ink-muted">{hint}</span>}
      </span>
      <span
        className={`whitespace-nowrap text-sm [font-variant-numeric:tabular-nums] ${
          emphasis ? "" : "text-ink-primary"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export function Breakdown({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col divide-y-0">{children}</div>;
}

export function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-surface p-4">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">
        {title}
      </h3>
      {children}
    </div>
  );
}
