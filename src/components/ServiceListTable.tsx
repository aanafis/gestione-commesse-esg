"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertChip } from "@/components/AlertChip";
import { formatHours, formatMoney, formatPercent, toNumber } from "@/lib/format";
import { SERVICE_STATUS_LABELS, label } from "@/lib/labels";
import type { ServiceListRow } from "@/lib/queries/service-list";

type SortKey = "marginPct" | "discountPct" | "hoursVariance";
type SortDir = "asc" | "desc";

const ALL = "__all__";

function uniqueSorted(values: (string | null)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => v !== null))).sort((a, b) =>
    a.localeCompare(b, "it")
  );
}

export function ServiceListTable({ rows }: { rows: ServiceListRow[] }) {
  const [status, setStatus] = useState(ALL);
  const [pm, setPm] = useState(ALL);
  const [serviceType, setServiceType] = useState(ALL);
  const [alert, setAlert] = useState(ALL);
  const [client, setClient] = useState(ALL);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const statuses = useMemo(() => uniqueSorted(rows.map((r) => r.status)), [rows]);
  const pms = useMemo(() => uniqueSorted(rows.map((r) => r.pmName)), [rows]);
  const serviceTypes = useMemo(() => uniqueSorted(rows.map((r) => r.serviceTypeName)), [rows]);
  const alerts = useMemo(() => uniqueSorted(rows.map((r) => r.alert)), [rows]);
  const clients = useMemo(() => uniqueSorted(rows.map((r) => r.clientName)), [rows]);

  const filtered = useMemo(() => {
    let result = rows.filter(
      (r) =>
        (status === ALL || r.status === status) &&
        (pm === ALL || r.pmName === pm) &&
        (serviceType === ALL || r.serviceTypeName === serviceType) &&
        (alert === ALL || r.alert === alert) &&
        (client === ALL || r.clientName === client)
    );

    if (sortKey) {
      result = [...result].sort((a, b) => {
        const av = toNumber(a[sortKey]) ?? -Infinity;
        const bv = toNumber(b[sortKey]) ?? -Infinity;
        return sortDir === "asc" ? av - bv : bv - av;
      });
    }
    return result;
  }, [rows, status, pm, serviceType, alert, client, sortKey, sortDir]);

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
        <FilterSelect label="Stato" value={status} onChange={setStatus} options={statuses} display={(v) => label(SERVICE_STATUS_LABELS, v)} />
        <FilterSelect label="PM" value={pm} onChange={setPm} options={pms} />
        <FilterSelect label="Tipo servizio" value={serviceType} onChange={setServiceType} options={serviceTypes} />
        <FilterSelect label="Alert" value={alert} onChange={setAlert} options={alerts} />
        <FilterSelect label="Cliente" value={client} onChange={setClient} options={clients} />
      </div>

      <p className="text-xs text-ink-muted">
        {filtered.length} di {rows.length} servizi
      </p>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gridline text-left text-ink-secondary">
              <th className="px-4 py-2 font-medium">Servizio</th>
              <th className="px-4 py-2 font-medium">Commessa</th>
              <th className="px-4 py-2 font-medium">Cliente</th>
              <th className="px-4 py-2 font-medium">Tipo</th>
              <th className="px-4 py-2 font-medium">Variante</th>
              <th className="px-4 py-2 font-medium">PM</th>
              <th className="px-4 py-2 font-medium">Stato</th>
              <th className="px-4 py-2 font-medium">Alert</th>
              <th
                className="cursor-pointer select-none px-4 py-2 text-right font-medium hover:text-ink-primary"
                onClick={() => toggleSort("marginPct")}
              >
                Margine % {sortIndicator("marginPct")}
              </th>
              <th
                className="cursor-pointer select-none px-4 py-2 text-right font-medium hover:text-ink-primary"
                onClick={() => toggleSort("discountPct")}
              >
                Sconto % {sortIndicator("discountPct")}
              </th>
              <th
                className="cursor-pointer select-none px-4 py-2 text-right font-medium hover:text-ink-primary"
                onClick={() => toggleSort("hoursVariance")}
              >
                Scostamento ore {sortIndicator("hoursVariance")}
              </th>
              <th className="px-4 py-2 text-right font-medium">Prezzo contrattualizzato</th>
            </tr>
          </thead>
          <tbody className="[font-variant-numeric:tabular-nums]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-6 text-center text-sm text-ink-muted">
                  Nessun servizio corrisponde ai filtri scelti.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.serviceId ?? r.code} className="border-b border-gridline last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`/servizi/${r.serviceId}`} className="font-medium text-ink-primary hover:underline">
                      {r.code}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-ink-secondary">{r.commessaCode}</td>
                  <td className="px-4 py-2 text-ink-secondary">{r.clientName}</td>
                  <td className="px-4 py-2 text-ink-secondary">{r.serviceTypeName}</td>
                  <td className="px-4 py-2 text-ink-secondary">{r.variant ?? "–"}</td>
                  <td className="px-4 py-2 text-ink-secondary">{r.pmName ?? "–"}</td>
                  <td className="px-4 py-2 text-ink-secondary">{label(SERVICE_STATUS_LABELS, r.status)}</td>
                  <td className="px-4 py-2">
                    <AlertChip alert={r.alert} />
                  </td>
                  <td className="px-4 py-2 text-right text-ink-secondary">{formatPercent(r.marginPct)}</td>
                  <td className="px-4 py-2 text-right text-ink-secondary">{formatPercent(r.discountPct)}</td>
                  <td className="px-4 py-2 text-right text-ink-secondary">{formatHours(r.hoursVariance)}</td>
                  <td className="px-4 py-2 text-right text-ink-secondary">{formatMoney(r.contractedPrice)}</td>
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
