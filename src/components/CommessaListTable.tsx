"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { csvNumber, csvPercent, formatMoney, formatPercent, toNumber } from "@/lib/format";
import { downloadCsv, rowsToCsv } from "@/lib/csv-export";
import { COMMESSA_STATUS_LABELS, label } from "@/lib/labels";
import type { CommessaListRow } from "@/lib/queries/commessa-list";

type SortKey = "marginPct" | "toBeInvoiced" | "contractValue";
type SortDir = "asc" | "desc";

const ALL = "__all__";
const QUADRATURA_OK = "ok";
const QUADRATURA_KO = "ko";

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

export function CommessaListTable({ rows }: { rows: CommessaListRow[] }) {
  const [status, setStatus] = useState(ALL);
  const [client, setClient] = useState(ALL);
  const [quadratura, setQuadratura] = useState(ALL);
  const [codeSearch, setCodeSearch] = useState("");
  const [assetSearch, setAssetSearch] = useState("");

  const [servicesMin, setServicesMin] = useState("");
  const [servicesMax, setServicesMax] = useState("");
  const [contractMin, setContractMin] = useState("");
  const [contractMax, setContractMax] = useState("");
  const [marginMin, setMarginMin] = useState("");
  const [marginMax, setMarginMax] = useState("");
  const [toBeInvoicedMin, setToBeInvoicedMin] = useState("");
  const [toBeInvoicedMax, setToBeInvoicedMax] = useState("");
  const [collectedMin, setCollectedMin] = useState("");
  const [collectedMax, setCollectedMax] = useState("");

  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const statuses = useMemo(() => uniqueSorted(rows.map((r) => r.status)), [rows]);
  const clients = useMemo(() => uniqueSorted(rows.map((r) => r.clientName)), [rows]);

  const filtered = useMemo(() => {
    const servicesMinN = parseRangeInput(servicesMin);
    const servicesMaxN = parseRangeInput(servicesMax);
    const contractMinN = parseRangeInput(contractMin);
    const contractMaxN = parseRangeInput(contractMax);
    const marginMinN = parseRangeInput(marginMin) !== null ? parseRangeInput(marginMin)! / 100 : null;
    const marginMaxN = parseRangeInput(marginMax) !== null ? parseRangeInput(marginMax)! / 100 : null;
    const toBeInvoicedMinN = parseRangeInput(toBeInvoicedMin);
    const toBeInvoicedMaxN = parseRangeInput(toBeInvoicedMax);
    const collectedMinN = parseRangeInput(collectedMin);
    const collectedMaxN = parseRangeInput(collectedMax);

    let result = rows.filter(
      (r) =>
        (status === ALL || r.status === status) &&
        (client === ALL || r.clientName === client) &&
        (quadratura === ALL ||
          (quadratura === QUADRATURA_OK && r.reconciliationOk) ||
          (quadratura === QUADRATURA_KO && !r.reconciliationOk)) &&
        (codeSearch === "" || r.code.toLowerCase().includes(codeSearch.toLowerCase())) &&
        (assetSearch === "" || (r.assetName ?? "").toLowerCase().includes(assetSearch.toLowerCase())) &&
        inRange(toNumber(r.servicesCount), servicesMinN, servicesMaxN) &&
        inRange(toNumber(r.contractValue), contractMinN, contractMaxN) &&
        inRange(toNumber(r.marginPct), marginMinN, marginMaxN) &&
        inRange(toNumber(r.toBeInvoiced), toBeInvoicedMinN, toBeInvoicedMaxN) &&
        inRange(toNumber(r.collected), collectedMinN, collectedMaxN)
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
    rows, status, client, quadratura, codeSearch, assetSearch,
    servicesMin, servicesMax, contractMin, contractMax, marginMin, marginMax,
    toBeInvoicedMin, toBeInvoicedMax, collectedMin, collectedMax,
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
      "Commessa", "Cliente", "Asset", "Stato", "N. servizi", "Valore contratto",
      "Quadratura", "Margine %", "Da fatturare", "Incassato",
    ];
    const csvRows = filtered.map((r) => [
      r.code,
      r.clientName,
      r.assetName ?? "",
      label(COMMESSA_STATUS_LABELS, r.status),
      csvNumber(r.servicesCount),
      csvNumber(r.contractValue),
      r.reconciliationOk ? "OK" : "Da rivedere",
      csvPercent(r.marginPct),
      csvNumber(r.toBeInvoiced),
      csvNumber(r.collected),
    ]);
    downloadCsv("commesse.csv", rowsToCsv(headers, csvRows));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <TextFilter label="Codice commessa" value={codeSearch} onChange={setCodeSearch} />
        <TextFilter label="Asset" value={assetSearch} onChange={setAssetSearch} />
        <FilterSelect label="Stato" value={status} onChange={setStatus} options={statuses} display={(v) => label(COMMESSA_STATUS_LABELS, v)} />
        <FilterSelect label="Cliente" value={client} onChange={setClient} options={clients} />
        <FilterSelect
          label="Quadratura"
          value={quadratura}
          onChange={setQuadratura}
          options={[QUADRATURA_OK, QUADRATURA_KO]}
          display={(v) => (v === QUADRATURA_OK ? "OK" : "Da rivedere")}
        />
        <RangeFilter label="N. servizi (min–max)" min={servicesMin} max={servicesMax} onMinChange={setServicesMin} onMaxChange={setServicesMax} />
        <RangeFilter label="Valore contratto (min–max)" min={contractMin} max={contractMax} onMinChange={setContractMin} onMaxChange={setContractMax} step="1000" />
        <RangeFilter label="Margine % (min–max)" min={marginMin} max={marginMax} onMinChange={setMarginMin} onMaxChange={setMarginMax} />
        <RangeFilter label="Da fatturare (min–max)" min={toBeInvoicedMin} max={toBeInvoicedMax} onMinChange={setToBeInvoicedMin} onMaxChange={setToBeInvoicedMax} step="1000" />
        <RangeFilter label="Incassato (min–max)" min={collectedMin} max={collectedMax} onMinChange={setCollectedMin} onMaxChange={setCollectedMax} step="1000" />
        <button
          type="button"
          onClick={exportCsv}
          className="ml-auto rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-ink-primary hover:border-accent"
        >
          Esporta CSV
        </button>
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
