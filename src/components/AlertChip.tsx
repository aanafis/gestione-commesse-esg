import { severityOf } from "@/lib/alert";

// Colore di stato + etichetta sempre insieme (mai solo colore) — vedi skill
// dataviz, palette.md § Status palette: "never color alone".
const DOT_CLASS: Record<string, string> = {
  good: "bg-status-good",
  warning: "bg-status-warning",
  serious: "bg-status-serious",
  critical: "bg-status-critical",
};

export function AlertChip({ alert }: { alert: string | null }) {
  // Colonna generata da un'espressione CASE: tipizzata nullable perché
  // Postgres non lo sa in anticipo, ma il ramo ELSE la rende sempre valorizzata.
  const label = alert ?? "OK";
  const severity = severityOf(label);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-ink-primary">
      <span className={`h-2 w-2 rounded-full ${DOT_CLASS[severity]}`} />
      {label}
    </span>
  );
}
