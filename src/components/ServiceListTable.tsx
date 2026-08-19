"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertChip } from "@/components/AlertChip";
import { csvNumber, csvPercent, formatHours, formatMoney, formatPercent, toNumber } from "@/lib/format";
import { downloadCsv, rowsToCsv } from "@/lib/csv-export";
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

/** null su entrambi gli estremi = nessun filtro attivo su questa colonna,
 * valore null nel dato = escluso solo se il filtro è davvero attivo. */
function inRange(value: number | null, min: number | null, max: number | null): boolean {
  if (min === null && max === null) return true;
  if (value === null) return false;
  if (min !== null && value < min) return false;
  if (max !== null && value > max) return false;
  return true;
}

function parseRangeInput(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function ServiceListTable({ rows }: { rows: ServiceListRow[] }) {
  const [status, setStatus] = useState(ALL);
  const [pm, setPm] = useState(ALL);
  const [serviceType, setServiceType] = useState(ALL);
  const [variant, setVariant] = useState(ALL);
  const [alert, setAlert] = useState(ALL);
  const [client, setClient] = useState(ALL);
  const [codeSearch, setCodeSearch] = useState("");
  const [commessaSearch, setCommessaSearch] = useState("");

  const [marginMin, setMarginMin] = useState("");
  const [marginMax, setMarginMax] = useState("");
  const [discountMin, setDiscountMin] = useState("");
  const [discountMax, setDiscountMax] = useState("");
  const [hoursVarMin, setHoursVarMin] = useState("");
  const [hoursVarMax, setHoursVarMax] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");

  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const statuses = useMemo(() => uniqueSorted(rows.map((r) => r.status)), [rows]);
  const pms = useMemo(() => uniqueSorted(rows.map((r) => r.pmName)), [rows]);
  const serviceTypes = useMemo(() => uniqueSorted(rows.map((r) => r.serviceTypeName)), [rows]);
  const variants = useMemo(() => uniqueSorted(rows.map((r) => r.variant)), [rows]);
  const alerts = useMemo(() => uniqueSorted(rows.map((r) => r.alert)), [rows]);
  const clients = useMemo(() => uniqueSorted(rows.map((r) => r.clientName)), [rows]);

  const filtered = useMemo(() => {
    const marginMinN = parseRangeInput(marginMin) !== null ? parseRangeInput(marginMin)! / 100 : null;
    const marginMaxN = parseRangeInput(marginMax) !== null ? parseRangeInput(marginMax)! / 100 : null;
    const discountMinN = parseRangeInput(discountMin) !== null ? parseRangeInput(discountMin)! / 100 : null;
    const discountMaxN = parseRangeInput(discountMax) !== null ? parseRangeInput(discountMax)! / 100 : null;
    const hoursVarMinN = parseRangeInput(hoursVarMin);
    const hoursVarMaxN = parseRangeInput(hoursVarMax);
    const priceMinN = parseRangeInput(priceMin);
    const priceMaxN = parseRangeInput(priceMax);

    let result = rows.filter(
      (r) =>
        (status === ALL || r.status === status) &&
        (pm === ALL || r.pmName === pm) &&
        (serviceType === ALL || r.serviceTypeName === serviceType) &&
        (variant === ALL || r.variant === variant) &&
        (alert === ALL || r.alert === alert) &&
        (client === ALL || r.clientName === client) &&
        (codeSearch === "" || r.code.toLowerCase().includes(codeSearch.toLowerCase())) &&
        (commessaSearch === "" || r.commessaCode.toLowerCase().includes(commessaSearch.toLowerCase())) &&
        inRange(toNumber(r.marginPct), marginMinN, marginMaxN) &&
        inRange(toNumber(r.discountPct), discountMinN, discountMaxN) &&
        inRange(toNumber(r.hoursVariance), hoursVarMinN, hoursVarMaxN) &&
        inRange(toNumber(r.contractedPrice), priceMinN, priceMaxN)
    );

    if (sortKey) {
      result = [...result].sort((a, b) => {
        const av = toNumber(a[sortKey]) ?? -Infinity;
        const bv = toNumber(b[sortKey]) ?? -Infinity;
        return sortDir === "asc" ? av - bv : bv - av;
      });
    }
    return result;
  }, [
    rows, status, pm, serviceType, variant, alert, client, codeSearch, commessaSearch,
    marginMin, marginMax, discountMin, discountMax, hoursVarMin, hoursVarMax, priceMin, priceMax,
    sortKey, sortDir,
  ]);

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

  function exportCsv() {
    const headers = [
      "Servizio", "Commessa", "Cliente", "Tipo", "Variante", "PM", "Stato", "Alert",
      "Margine %", "Sconto %", "Scostamento ore", "Prezzo contrattualizzato",
    ];
    const csvRows = filtered.map((r) => [
      r.code,
      r.commessaCode,
      r.clientName,
      r.serviceTypeName,
      r.variant ?? "",
      r.pmName ?? "",
      label(SERVICE_STATUS_LABELS, r.status),
      r.alert ?? "",
      csvPercent(r.marginPct),
      csvPercent(r.discountPct),
      csvNumber(r.hoursVariance),
      csvNumber(r.contractedPrice),
    ]);
    downloadCsv("servizi.csv", rowsToCsv(headers, csvRows));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <TextFilter label="Codice servizio" value={codeSearch} onChange={setCodeSearch} />
        <TextFilter label="Codice commessa" value={commessaSearch} onChange={setCommessaSearch} />
        <FilterSelect label="Stato" value={status} onChange={setStatus} options={statuses} display={(v) => label(SERVICE_STATUS_LABELS, v)} />
        <FilterSelect label="PM" value={pm} onChange={setPm} options={pms} />
        <FilterSelect label="Tipo servizio" value={serviceType} onChange={setServiceType} options={serviceTypes} />
        <FilterSelect label="Variante" value={variant} onChange={setVariant} options={variants} />
        <FilterSelect label="Alert" value={alert} onChange={setAlert} options={alerts} />
        <FilterSelect label="Cliente" value={client} onChange={setClient} options={clients} />
        <RangeFilter label="Margine % (min–max)" min={marginMin} max={marginMax} onMinChange={setMarginMin} onMaxChange={setMarginMax} />
        <RangeFilter label="Sconto % (min–max)" min={discountMin} max={discountMax} onMinChange={setDiscountMin} onMaxChange={setDiscountMax} />
        <RangeFilter label="Scostamento ore (min–max)" min={hoursVarMin} max={hoursVarMax} onMinChange={setHoursVarMin} onMaxChange={setHoursVarMax} />
        <RangeFilter label="Prezzo contratt. (min–max)" min={priceMin} max={priceMax} onMinChange={setPriceMin} onMaxChange={setPriceMax} step="100" />
        <button
          type="button"
          onClick={exportCsv}
          className="ml-auto rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-ink-primary hover:border-accent"
        >
          Esporta CSV
        </button>
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

function TextFilter({ label: labelText, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-ink-secondary">
      {labelText}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="cerca…"
        className="w-32 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-ink-primary"
      />
    </label>
  );
}

function RangeFilter({
  label: labelText,
  min,
  max,
  onMinChange,
  onMaxChange,
  step = "1",
}: {
  label: string;
  min: string;
  max: string;
  onMinChange: (v: string) => void;
  onMaxChange: (v: string) => void;
  step?: string;
}) {
  return (
    <div className="flex flex-col gap-1 text-xs text-ink-secondary">
      <span>{labelText}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          step={step}
          value={min}
          onChange={(e) => onMinChange(e.target.value)}
          placeholder="min"
          className="w-20 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-ink-primary"
        />
        <span>–</span>
        <input
          type="number"
          step={step}
          value={max}
          onChange={(e) => onMaxChange(e.target.value)}
          placeholder="max"
          className="w-20 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-ink-primary"
        />
      </div>
    </div>
  );
}
