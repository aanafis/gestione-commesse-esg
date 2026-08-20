// Card "widget" del Cruscotto (§6.1) — come Card in Breakdown.tsx ma con
// ombra e una seconda riga facoltativa nell'intestazione (meta): il resto
// dell'app usa Card così com'è, questa è una variante solo per la nuova
// impaginazione a griglia del Cruscotto, per non cambiare look altrove
// senza che sia stato chiesto.
export function DashboardCard({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card-shadow flex flex-col gap-3.5 rounded-xl border border-border bg-surface p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink-primary">{title}</h2>
        {meta && <span className="text-xs text-ink-muted">{meta}</span>}
      </div>
      {children}
    </div>
  );
}
