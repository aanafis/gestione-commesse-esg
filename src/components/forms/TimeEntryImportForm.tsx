"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  importTimeEntries,
  parseTimeEntryCsv,
  type CsvUploadState,
  type ImportResultState,
} from "@/lib/actions/time-entry-import";
import { Field, Select, TextInput } from "@/components/forms/Field";

const UPLOAD_INITIAL: CsvUploadState = { step: "idle" };
const IMPORT_INITIAL: ImportResultState = { step: "idle" };

export function TimeEntryImportForm() {
  const [uploadState, uploadAction, uploadPending] = useActionState(parseTimeEntryCsv, UPLOAD_INITIAL);
  const [importState, importAction, importPending] = useActionState(importTimeEntries, IMPORT_INITIAL);
  const [monthMode, setMonthMode] = useState<"column" | "fixed">("column");

  if (importState.step === "done") {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6">
        <p className="text-sm text-ink-primary">
          Import completato: <strong>{importState.insertedCount}</strong> righe nuove,{" "}
          <strong>{importState.updatedCount}</strong> aggiornate (stesso mese/servizio/persona di un
          import precedente).
        </p>
        {(importState.errors?.length ?? 0) > 0 && (
          <IssueList title="Righe scartate" issues={importState.errors!} tone="critical" />
        )}
        {(importState.warnings?.length ?? 0) > 0 && (
          <IssueList title="Avvisi (importate comunque)" issues={importState.warnings!} tone="warning" />
        )}
        <div>
          <Link href="/controllo-ore" className="text-sm text-accent hover:underline">
            Vai a Controllo ore
          </Link>
        </div>
      </div>
    );
  }

  // Fase 1: nessun file ancora caricato
  if (uploadState.step !== "mapped") {
    return (
      <form action={uploadAction} className="flex max-w-md flex-col gap-4">
        {uploadState.step === "error" && (
          <p className="rounded-md border border-status-critical/30 bg-status-critical/10 px-3 py-2 text-sm text-status-critical">
            {uploadState.error}
          </p>
        )}
        <Field label="File CSV" htmlFor="file" hint="Esportato dal sistema di timesheet — una riga per persona/servizio/mese">
          <input
            type="file"
            id="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
          />
        </Field>
        <div>
          <button
            type="submit"
            disabled={uploadPending}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {uploadPending ? "Lettura…" : "Carica"}
          </button>
        </div>
      </form>
    );
  }

  // Fase 2: file letto, mappa le colonne
  const headers = uploadState.headers ?? [];
  const values = importState.values;

  return (
    <form action={importAction} className="flex max-w-2xl flex-col gap-6">
      <input type="hidden" name="csvText" value={uploadState.csvText} />

      {importState.step === "error" && (
        <p className="rounded-md border border-status-critical/30 bg-status-critical/10 px-3 py-2 text-sm text-status-critical">
          {importState.error}
        </p>
      )}

      <div className="rounded-lg border border-border bg-surface p-3 text-xs text-ink-muted">
        {uploadState.totalDataRows} righe di dati trovate. Anteprima:
        <div className="mt-2 overflow-x-auto">
          <table className="text-xs">
            <thead>
              <tr>
                {headers.map((h) => (
                  <th key={h} className="border-b border-gridline px-2 py-1 text-left font-medium text-ink-secondary">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(uploadState.sampleRows ?? []).map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className="px-2 py-1 text-ink-secondary">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <legend className="px-1 text-sm font-medium text-ink-primary">Mese</legend>
        <div className="flex gap-4 text-sm text-ink-secondary">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="monthMode"
              value="column"
              checked={monthMode === "column"}
              onChange={() => setMonthMode("column")}
            />
            È una colonna del CSV
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="monthMode"
              value="fixed"
              checked={monthMode === "fixed"}
              onChange={() => setMonthMode("fixed")}
            />
            Tutte le righe sono dello stesso mese
          </label>
        </div>
        {monthMode === "column" ? (
          <ColumnSelect name="monthColumn" headers={headers} defaultValue={values?.monthColumn} />
        ) : (
          <input
            type="month"
            name="fixedMonth"
            defaultValue={values?.fixedMonth}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink-primary"
          />
        )}
      </fieldset>

      <Field label="Colonna servizio" htmlFor="serviceColumn" hint="Deve contenere il codice servizio, es. 26-017-A">
        <ColumnSelect name="serviceColumn" headers={headers} defaultValue={values?.serviceColumn} />
      </Field>

      <Field label="Colonna persona" htmlFor="personColumn" hint="Email o nome esatto">
        <ColumnSelect name="personColumn" headers={headers} defaultValue={values?.personColumn} />
      </Field>

      <Field label="Colonna ore" htmlFor="hoursColumn">
        <ColumnSelect name="hoursColumn" headers={headers} defaultValue={values?.hoursColumn} />
      </Field>

      <Field label="Colonna fase" htmlFor="phaseColumn" hint="Facoltativa">
        <ColumnSelect name="phaseColumn" headers={headers} defaultValue={values?.phaseColumn} allowNone />
      </Field>

      <div className="flex gap-3">
        <button
          type="submit"
          name="mode"
          value="preview"
          disabled={importPending}
          className="rounded-md border border-accent px-4 py-2 text-sm font-medium text-accent disabled:opacity-50"
        >
          {importPending ? "Verifica…" : "Verifica"}
        </button>
        {importState.step === "preview" && (
          <button
            type="submit"
            name="mode"
            value="commit"
            disabled={importPending || (importState.validCount ?? 0) === 0}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {importPending ? "Importazione…" : `Conferma e importa ${importState.validCount} righe`}
          </button>
        )}
      </div>

      {importState.step === "preview" && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <p className="text-sm text-ink-primary">
            {importState.totalRows} righe totali — <strong>{importState.validCount}</strong> pronte da
            importare
            {(importState.errors?.length ?? 0) > 0 && (
              <> , {importState.errors!.length} scartate</>
            )}
            .
          </p>
          {(importState.errors?.length ?? 0) > 0 && (
            <IssueList title="Righe scartate — non verranno importate" issues={importState.errors!} tone="critical" />
          )}
          {(importState.warnings?.length ?? 0) > 0 && (
            <IssueList title="Avvisi — importate comunque" issues={importState.warnings!} tone="warning" />
          )}
        </div>
      )}
    </form>
  );
}

function ColumnSelect({
  name,
  headers,
  defaultValue,
  allowNone,
}: {
  name: string;
  headers: string[];
  defaultValue?: string;
  allowNone?: boolean;
}) {
  return (
    <Select id={name} name={name} defaultValue={defaultValue ?? (allowNone ? "" : "")}>
      {allowNone && <option value="">Nessuna</option>}
      {!allowNone && <option value="">Seleziona…</option>}
      {headers.map((h, i) => (
        <option key={i} value={i}>
          {h}
        </option>
      ))}
    </Select>
  );
}

function IssueList({
  title,
  issues,
  tone,
}: {
  title: string;
  issues: { row: number; message: string }[];
  tone: "critical" | "warning";
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className={`text-xs font-medium ${tone === "critical" ? "text-status-critical" : "text-status-warning"}`}>
        {title} ({issues.length}{issues.length >= 50 ? "+" : ""})
      </p>
      <ul className="max-h-40 overflow-y-auto text-xs text-ink-secondary">
        {issues.map((issue, i) => (
          <li key={i}>
            Riga {issue.row}: {issue.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
