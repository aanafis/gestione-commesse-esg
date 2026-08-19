"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatMoney, formatPercent, toNumber } from "@/lib/format";
import { COMMESSA_STATUS_LABELS, label } from "@/lib/labels";
import type { CommessaListRow } from "@/lib/queries/commessa-list";

type SortKey = "marginPct" | "toBeInvoiced" | "contractValue";
type SortDir = "asc" | "desc";

const ALL = "__all__";

function uniqueSorted(values: (string | null)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => v !== null))).sort((a, b) =>
    a.localeCompare(b, "it")
  );
}

export function CommessaListTable({ rows }: { rows: CommessaListRow[] }) {
  const [status, setStatus] = useState(ALL);
  const [client, setClient] = useState(ALL);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const statuses = useMemo(() => uniqueSorted(rows.map((r) => r.status)), [rows]);
  const clients = useMemo(() => uniqueSorted(rows.map((r) => r.clientName)), [rows]);

  const filtered = useMemo(() => {
    let result = rows.filter(
      (r) => (status === ALL || r.status === status) && (client === ALL || r.clientName === client)
    );

    if (sortKey) {
      result = [...result].sort((a, b) => {
        const av = toNumber(a[sortKey]) ?? -Infinity;
        const bv = toNumber(b[sortKey]) ?? -Infinity;
        return sortDir === "asc" ? av - bv : bv - av;
      });
    }
    return result;
  }, [rows, status, client, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return null;
    return <span className="ml-1 text-ink-muted">{sortDir === "asc" ? "▲" : "▼"}</span>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <FilterSelect label="Stato" value={status} onChange={setStatus} options={statuses} display={(v) => label(COMMESSA_STATUS_LABELS, v)} />
        <FilterSelect label="Cliente" value={client} onChange={setClient} options={clients} />
      </div>

      <p className="text-xs text-ink-muted">
        {filtered.length} di {rows.length} commesse
      </p>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gridline text-left text-ink-secondary">
              <th className="px-4 py-2 font-medium">Commessa</th>
              <th className="px-4 py-2 font-medium">Cliente</th>
              <th className="px-4 py-2 font-medium">Asset</th>
              <th className="px-4 py-2 font-medium">Stato</th>
              <th className="px-4 py-2 text-right font-medium">N. servizi</th>
              <th
                className="cursor-pointer select-none px-4 py-2 text-right font-medium hover:text-ink-primary"
                onClick={() => toggleSort("contractValue")}
              >
                Valore contratto {sortIndicator("contractValue")}
              </th>
              <th className="px-4 py-2 text-center font-medium">Quadratura</th>
              <th
                className="cursor-pointer select-none px-4 py-2 text-right font-medium hover:text-ink-primary"
                onClick={() => toggleSort("marginPct")}
              >
                Margine % {sortIndicator("marginPct")}
              </th>
              <th
                className="cursor-pointer select-none px-4 py-2 text-right font-medium hover:text-ink-primary"
                onClick={() => toggleSort("toBeInvoiced")}
              >
                Da fatturare {sortIndicator("toBeInvoiced")}
              </th>
              <th className="px-4 py-2 text-right font-medium">Incassato</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="[font-variant-numeric:tabular-nums]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-6 text-center text-sm text-ink-muted">
                  Nessuna commessa corrisponde ai filtri scelti.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.commessaId ?? r.code} className="border-b border-gridline last:border-0">
                  <td className="px-4 py-2 font-medium text-ink-primary">{r.code}</td>
                  <td className="px-4 py-2 text-ink-secondary">{r.clientName}</td>
                  <td className="px-4 py-2 text-ink-secondary">{r.assetName ?? "–"}</td>
                  <td className="px-4 py-2 text-ink-secondary">{label(COMMESSA_STATUS_LABELS, r.status)}</td>
                  <td className="px-4 py-2 text-right text-ink-secondary">{r.servicesCount ?? 0}</td>
                  <td className="px-4 py-2 text-right text-ink-secondary">{formatMoney(r.contractValue)}</td>
                  <td className="px-4 py-2 text-center">
                    {r.reconciliationOk ? (
                      <span className="text-status-good">OK</span>
                    ) : (
                      <span className="font-medium text-status-critical" title="Somma prezzi servizi ≠ valore contratto">
                        Da rivedere
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right text-ink-secondary">{formatPercent(r.marginPct)}</td>
                  <td className="px-4 py-2 text-right text-ink-secondary">{formatMoney(r.toBeInvoiced)}</td>
                  <td className="px-4 py-2 text-right text-ink-secondary">{formatMoney(r.collected)}</td>
                  <td className="px-4 py-2 text-right">
                    <Link href={`/commesse/${r.commessaId}/modifica`} className="text-accent hover:underline">
                      Modifica
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterSelect({
  label: labelText,
  value,
  onChange,
  options,
  display,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  display?: (v: string) => string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-ink-secondary">
      {labelText}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-ink-primary"
      >
        <option value={ALL}>Tutti</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {display ? display(o) : o}
          </option>
        ))}
      </select>
    </label>
  );
}
