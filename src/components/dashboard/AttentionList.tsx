import Link from "next/link";
import { AlertChip } from "@/components/AlertChip";
import { severityOf } from "@/lib/alert";
import { formatPercent } from "@/lib/format";

// Lista "Servizi in attenzione" del Cruscotto (§6.1) — stessa AlertChip già
// usata ovunque nell'app (mai un badge nuovo per lo stesso concetto), solo
// con una striscia colorata a sinistra per leggere la gravità a colpo
// d'occhio in un elenco, invece che badge per badge.
const STRIPE_CLASS: Record<string, string> = {
  good: "border-status-good",
  warning: "border-status-warning",
  serious: "border-status-serious",
  critical: "border-status-critical",
};

export function AttentionList({
  alerts,
}: {
  alerts: {
    serviceId: string | null;
    code: string | null;
    commessaCode: string | null;
    alert: string | null;
    marginPct: string | null;
    discountPct: string | null;
  }[];
}) {
  if (alerts.length === 0) {
    return <p className="text-sm text-ink-muted">Nessun servizio attivo richiede attenzione.</p>;
  }

  return (
    <div className="flex flex-col gap-px overflow-hidden rounded-lg bg-gridline">
      {alerts.map((a) => {
        const severity = severityOf(a.alert ?? "OK");
        const showMargin = a.alert === "MARGINE CRITICO";
        return (
          <Link
            key={a.serviceId}
            href={`/servizi/${a.serviceId}`}
            className={`flex items-center justify-between gap-3 border-l-[3px] bg-surface px-3 py-2.5 hover:bg-page ${STRIPE_CLASS[severity]}`}
          >
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-medium text-ink-primary">{a.code}</span>
              <span className="text-xs text-ink-muted">Commessa {a.commessaCode}</span>
            </div>
            <div className="flex flex-none items-center gap-3">
              {showMargin && (
                <span className="whitespace-nowrap text-xs text-ink-secondary">
                  Margine {formatPercent(a.marginPct)}
                </span>
              )}
              <AlertChip alert={a.alert} />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
