"use server";

import { db } from "@/lib/db";
import { parseCsv } from "@/lib/csv";
import type { TimeEntrySource } from "@/lib/db/types";
import { getSession } from "@/lib/auth/dal";

// Import ore da CSV (§4.2 TimeEntry, §6.5, §9). Due passaggi:
// 1) parseTimeEntryCsv: legge il file, restituisce intestazioni + un
//    'anteprima per la mappatura colonne.
// 2) importTimeEntries: rilegge il CSV (passato come testo nascosto tra i
//    due passaggi — niente storage temporaneo da gestire) con la
//    mappatura scelta, valida ogni riga, e — solo se mode="commit" — scrive.
//    mode="preview" valida senza scrivere, così l'utente vede cosa
//    entrerà e cosa no PRIMA di confermare (mai un import silenzioso).
//
// Re-importare lo stesso mese non duplica le ore: per ogni riga valida,
// se esiste già una riga con source='import' per la stessa tripla
// (mese, servizio, persona) viene aggiornata, non raddoppiata. Le righe
// inserite a mano (source='manual') non vengono mai toccate da un import.

export type CsvUploadState = {
  step: "idle" | "error" | "mapped";
  error?: string;
  csvText?: string;
  headers?: string[];
  sampleRows?: string[][];
  totalDataRows?: number;
};

export async function parseTimeEntryCsv(
  _prevState: CsvUploadState,
  formData: FormData
): Promise<CsvUploadState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { step: "error", error: "Seleziona un file CSV." };
  }

  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length < 2) {
    return { step: "error", error: "Il file non contiene righe di dati oltre all'intestazione." };
  }

  return {
    step: "mapped",
    csvText: text,
    headers: rows[0],
    sampleRows: rows.slice(1, 4),
    totalDataRows: rows.length - 1,
  };
}

export type RowIssue = { row: number; message: string };

export type ImportFormValues = {
  csvText: string;
  monthMode: "column" | "fixed";
  monthColumn: string;
  fixedMonth: string;
  serviceColumn: string;
  personColumn: string;
  hoursColumn: string;
  phaseColumn: string;
};

export type ImportResultState = {
  step: "idle" | "error" | "preview" | "done";
  error?: string;
  values?: ImportFormValues;
  totalRows?: number;
  validCount?: number;
  errors?: RowIssue[];
  warnings?: RowIssue[];
  insertedCount?: number;
  updatedCount?: number;
};

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function normalizeMonth(raw: string): string | null {
  const trimmed = raw.trim();
  if (MONTH_RE.test(trimmed)) return trimmed;
  // fallback: "MM/YYYY" o "M/YYYY", comune negli export Excel italiani
  const m = trimmed.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) {
    const month = m[1].padStart(2, "0");
    const year = m[2];
    if (Number(month) >= 1 && Number(month) <= 12) return `${year}-${month}`;
  }
  return null;
}

function normalizeHours(raw: string): number | null {
  const n = Number(raw.trim().replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

async function validateRows(values: ImportFormValues) {
  const dataRows = parseCsv(values.csvText).slice(1);

  const monthColIdx = values.monthMode === "column" ? Number(values.monthColumn) : -1;
  const serviceColIdx = Number(values.serviceColumn);
  const personColIdx = Number(values.personColumn);
  const hoursColIdx = Number(values.hoursColumn);
  const phaseColIdx = values.phaseColumn === "" ? -1 : Number(values.phaseColumn);

  const [services, people] = await Promise.all([
    db.selectFrom("service").select(["id", "code"]).execute(),
    db.selectFrom("person").select(["id", "name", "email"]).execute(),
  ]);
  const serviceByCode = new Map(services.map((s) => [s.code.toLowerCase(), s.id]));
  const personByEmail = new Map(people.map((p) => [p.email.toLowerCase(), p.id]));
  const personByName = new Map(people.map((p) => [p.name.toLowerCase(), p.id]));

  const phases = await db.selectFrom("phase").select(["id", "serviceId", "name"]).execute();
  const phaseByServiceAndName = new Map(
    phases.map((p) => [`${p.serviceId}:${p.name.toLowerCase()}`, p.id])
  );

  const errors: RowIssue[] = [];
  const warnings: RowIssue[] = [];
  const valid: { month: string; serviceId: string; personId: string; hours: number; phaseId: string | null }[] = [];

  dataRows.forEach((cols, i) => {
    const rowNum = i + 2; // +1 header, +1 per contare da 1
    if (cols.every((c) => c === "")) return; // riga vuota, ignorata silenziosamente

    const month = values.monthMode === "fixed" ? values.fixedMonth : normalizeMonth(cols[monthColIdx] ?? "");
    if (!month || !MONTH_RE.test(month)) {
      errors.push({ row: rowNum, message: `Mese non valido: "${cols[monthColIdx] ?? ""}"` });
      return;
    }

    const serviceCode = (cols[serviceColIdx] ?? "").trim();
    const serviceId = serviceByCode.get(serviceCode.toLowerCase());
    if (!serviceId) {
      errors.push({ row: rowNum, message: `Servizio non trovato: "${serviceCode}"` });
      return;
    }

    const personRaw = (cols[personColIdx] ?? "").trim();
    const personId = personRaw.includes("@")
      ? personByEmail.get(personRaw.toLowerCase())
      : personByName.get(personRaw.toLowerCase()) ?? personByEmail.get(personRaw.toLowerCase());
    if (!personId) {
      errors.push({ row: rowNum, message: `Persona non trovata: "${personRaw}"` });
      return;
    }

    const hours = normalizeHours(cols[hoursColIdx] ?? "");
    if (hours === null) {
      errors.push({ row: rowNum, message: `Ore non valide: "${cols[hoursColIdx] ?? ""}"` });
      return;
    }

    let phaseId: string | null = null;
    if (phaseColIdx >= 0) {
      const phaseName = (cols[phaseColIdx] ?? "").trim();
      if (phaseName) {
        const found = phaseByServiceAndName.get(`${serviceId}:${phaseName.toLowerCase()}`);
        if (found) {
          phaseId = found;
        } else {
          warnings.push({ row: rowNum, message: `Fase non trovata ("${phaseName}") — importata senza fase collegata.` });
        }
      }
    }

    valid.push({ month, serviceId, personId, hours, phaseId });
  });

  return { dataRows, errors, warnings, valid };
}

export async function importTimeEntries(
  _prevState: ImportResultState,
  formData: FormData
): Promise<ImportResultState> {
  const session = await getSession();
  if (!session) {
    return { step: "error", error: "Sessione scaduta — accedi di nuovo." };
  }

  const values: ImportFormValues = {
    csvText: String(formData.get("csvText") ?? ""),
    monthMode: String(formData.get("monthMode") ?? "column") as "column" | "fixed",
    monthColumn: String(formData.get("monthColumn") ?? ""),
    fixedMonth: String(formData.get("fixedMonth") ?? ""),
    serviceColumn: String(formData.get("serviceColumn") ?? ""),
    personColumn: String(formData.get("personColumn") ?? ""),
    hoursColumn: String(formData.get("hoursColumn") ?? ""),
    phaseColumn: String(formData.get("phaseColumn") ?? ""),
  };
  const mode = String(formData.get("mode") ?? "preview");

  if (!values.csvText) {
    return { step: "error", error: "Sessione di import scaduta — ricarica il file." };
  }
  if (values.serviceColumn === "" || values.personColumn === "" || values.hoursColumn === "") {
    return { step: "error", error: "Mappa almeno colonna servizio, persona e ore.", values };
  }
  if (values.monthMode === "column" && values.monthColumn === "") {
    return { step: "error", error: "Mappa la colonna del mese, oppure scegli un mese fisso.", values };
  }
  if (values.monthMode === "fixed" && !MONTH_RE.test(values.fixedMonth)) {
    return { step: "error", error: "Mese fisso non valido — usa AAAA-MM.", values };
  }

  const { dataRows, errors, warnings, valid } = await validateRows(values);

  if (mode === "preview") {
    return {
      step: "preview",
      values,
      totalRows: dataRows.length,
      validCount: valid.length,
      errors: errors.slice(0, 50),
      warnings: warnings.slice(0, 50),
    };
  }

  // mode === "commit"
  let insertedCount = 0;
  let updatedCount = 0;

  await db.transaction().execute(async (trx) => {
    for (const row of valid) {
      const existing = await trx
        .selectFrom("timeEntry")
        .select("id")
        .where("month", "=", row.month)
        .where("serviceId", "=", row.serviceId)
        .where("personId", "=", row.personId)
        .where("source", "=", "import" as TimeEntrySource)
        .executeTakeFirst();

      const person = await trx
        .selectFrom("person as p")
        .innerJoin("level as l", "l.id", "p.levelId")
        .select("l.internalCostRate")
        .where("p.id", "=", row.personId)
        .executeTakeFirstOrThrow();

      if (existing) {
        await trx
          .updateTable("timeEntry")
          .set({
            hours: row.hours.toFixed(2),
            phaseId: row.phaseId,
            costRateSnapshot: person.internalCostRate,
            updatedBy: session.personId,
          })
          .where("id", "=", existing.id)
          .execute();
        updatedCount++;
      } else {
        await trx
          .insertInto("timeEntry")
          .values({
            month: row.month,
            serviceId: row.serviceId,
            personId: row.personId,
            phaseId: row.phaseId,
            hours: row.hours.toFixed(2),
            source: "import",
            costRateSnapshot: person.internalCostRate,
            createdBy: session.personId,
            updatedBy: session.personId,
          })
          .execute();
        insertedCount++;
      }
    }
  });

  return {
    step: "done",
    totalRows: dataRows.length,
    validCount: valid.length,
    insertedCount,
    updatedCount,
    errors: errors.slice(0, 50),
    warnings: warnings.slice(0, 50),
  };
}
