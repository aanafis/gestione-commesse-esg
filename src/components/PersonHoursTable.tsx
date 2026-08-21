"use client";

import { Fragment, useState } from "react";
import { AlertChip } from "@/components/AlertChip";
import { severityOf, type Severity } from "@/lib/alert";
import { formatHours, formatPercent } from "@/lib/format";

// Tabella "Per persona" del Controllo ore (richiesta dall'utente): una riga
// per persona (non una per assegnazione, come prima — chi ha 3 servizi non
// deve comparire 3 volte), che si espande al click mostrando le stesse ore
// suddivise per commessa e per servizio, invece di dover leggere la tabella
// "Per servizio" cercando ogni riga di quella persona a mano.

// Diverse colonne arrivano tipizzate nullable perché vengono da una vista
// (Postgres non garantisce la non-nullabilità delle colonne calcolate in
// fase di introspezione) — filtrate/usate con ?? qui sotto, non lo sono mai
// davvero per una riga di assegnazione reale.
type AssignmentRow = {
  assignmentId: string | null;
  personId: string | null;
  personName: string | null;
  serviceCode: string;
  commessaCode: string;
  estimatedHours: string | null;
  actualHours: string | null;
  etcHours: string | null;
  eacHours: string | null;
  variance: string | null;
  consumedPct: string | null;
  alert: string | null;
};

const SEVERITY_ORDER: Severity[] = ["critical", "serious", "warning", "good"];

function worstAlert(alerts: (string | null)[]): string | null {
  const real = alerts.filter((a): a is string => !!a && a !== "OK");
  if (real.length === 0) return null;
  return real.reduce((worst, a) =>
    SEVERITY_ORDER.indexOf(severityOf(a)) < SEVERITY_ORDER.indexOf(severityOf(worst)) ? a : worst
  );
}

function sum(rows: AssignmentRow[], key: "estimatedHours" | "actualHours" | "etcHours" | "eacHours" | "variance"): number {
  return rows.reduce((total, r) => total + Number(r[key] ?? 0), 0);
}

export function PersonHoursTable({ rows }: { rows: AssignmentRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const byPerson = new Map<string, AssignmentRow[]>();
  for (const r of rows) {
    const key = r.personId ?? "";
    if (!byPerson.has(key)) byPerson.set(key, []);
    byPerson.get(key)!.push(r);
  }

  const summaries = Array.from(byPerson.entries()).map(([personId, personRows]) => {
    const estimatedHours = sum(personRows, "estimatedHours");
    const actualHours = sum(personRows, "actualHours");
    return {
      personId,
      personName: personRows[0].personName ?? "—",
      rows: personRows,
      estimatedHours,
      actualHours,
      etcHours: sum(personRows, "etcHours"),
      eacHours: sum(personRows, "eacHours"),
      variance: sum(personRows, "variance"),
      consumedPct: estimatedHours > 0 ? actualHours / estimatedHours : null,
      alert: worstAlert(personRows.map((r) => r.alert)),
    };
  });
  summaries.sort((a, b) => b.variance - a.variance);

  if (summaries.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-muted">Nessuna assegnazione su servizi non chiusi.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gridline text-left text-ink-secondary">
            <th className="px-4 py-2 font-medium">Persona</th>
            <th className="px-4 py-2 text-right font-medium">Stimate</th>
            <th className="px-4 py-2 text-right font-medium">Consuntivo</th>
            <th className="px-4 py-2 text-right font-medium">ETC</th>
            <th className="px-4 py-2 text-right font-medium">EAC</th>
            <th className="px-4 py-2 text-right font-medium">Scostamento</th>
            <th className="px-4 py-2 text-right font-medium">Consumate %</th>
            <th className="px-4 py-2 font-medium">Alert</th>
          </tr>
        </thead>
        <tbody className="[font-variant-numeric:tabular-nums]">
          {summaries.map((p) => {
            const isOpen = expandedId === p.personId;

            const byCommessa = new Map<string, AssignmentRow[]>();
            for (const r of p.rows) {
              if (!byCommessa.has(r.commessaCode)) byCommessa.set(r.commessaCode, []);
              byCommessa.get(r.commessaCode)!.push(r);
            }

            return (
              <Fragment key={p.personId}>
                <tr
                  onClick={() => setExpandedId(isOpen ? null : p.personId)}
                  className="cursor-pointer border-b border-gridline last:border-0 hover:bg-page"
                >
                  <td className="px-4 py-2 text-ink-primary">
                    <span className="mr-1.5 inline-block w-3 text-ink-muted">{isOpen ? "▾" : "▸"}</span>
                    {p.personName}
                  </td>
                  <td className="px-4 py-2 text-right text-ink-secondary">{formatHours(p.estimatedHours)}</td>
                  <td className="px-4 py-2 text-right text-ink-secondary">{formatHours(p.actualHours)}</td>
                  <td className="px-4 py-2 text-right text-ink-secondary">{formatHours(p.etcHours)}</td>
                  <td className="px-4 py-2 text-right text-ink-secondary">{formatHours(p.eacHours)}</td>
                  <td className="px-4 py-2 text-right text-ink-secondary">{formatHours(p.variance)}</td>
                  <td className="px-4 py-2 text-right text-ink-secondary">{formatPercent(p.consumedPct)}</td>
                  <td className="px-4 py-2">{p.alert ? <AlertChip alert={p.alert} /> : "–"}</td>
                </tr>
                {isOpen && (
                  <tr className="border-b border-gridline bg-page last:border-0">
                    <td colSpan={8} className="px-4 py-4">
                      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <div className="flex flex-col gap-2">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                            Per commessa
                          </h4>
                          <DetailTable
                            rows={Array.from(byCommessa.entries()).map(([commessaCode, group]) => ({
                              key: commessaCode,
                              label: commessaCode,
                              estimatedHours: sum(group, "estimatedHours"),
                              actualHours: sum(group, "actualHours"),
                              eacHours: sum(group, "eacHours"),
                              variance: sum(group, "variance"),
                            }))}
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                            Per servizio
                          </h4>
                          <DetailTable
                            rows={p.rows.map((r) => ({
                              key: r.assignmentId ?? `${r.serviceCode}-${r.commessaCode}`,
                              label: `${r.serviceCode} (${r.commessaCode})`,
                              estimatedHours: Number(r.estimatedHours),
                              actualHours: Number(r.actualHours),
                              eacHours: Number(r.eacHours),
                              variance: Number(r.variance),
                            }))}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DetailTable({
  rows,
}: {
  rows: { key: string; label: string; estimatedHours: number; actualHours: number; eacHours: number; variance: number }[];
}) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gridline text-left text-ink-secondary">
            <th className="px-3 py-1.5 font-medium">&nbsp;</th>
            <th className="px-3 py-1.5 text-right font-medium">Stimate</th>
            <th className="px-3 py-1.5 text-right font-medium">Consuntivo</th>
            <th className="px-3 py-1.5 text-right font-medium">EAC</th>
            <th className="px-3 py-1.5 text-right font-medium">Scostamento</th>
          </tr>
        </thead>
        <tbody className="[font-variant-numeric:tabular-nums]">
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-gridline last:border-0">
              <td className="px-3 py-1.5 text-ink-primary">{r.label}</td>
              <td className="px-3 py-1.5 text-right text-ink-secondary">{formatHours(r.estimatedHours)}</td>
              <td className="px-3 py-1.5 text-right text-ink-secondary">{formatHours(r.actualHours)}</td>
              <td className="px-3 py-1.5 text-right text-ink-secondary">{formatHours(r.eacHours)}</td>
              <td className="px-3 py-1.5 text-right text-ink-secondary">{formatHours(r.variance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
