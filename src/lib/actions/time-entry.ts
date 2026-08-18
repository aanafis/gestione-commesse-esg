"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/dal";

// Registrazione manuale di una singola riga ore (§4.2 TimeEntry) — a fianco
// dell'import CSV mensile (time-entry-import.ts), per correggere/integrare
// senza rifare tutto il mese.
//
// cost_rate_snapshot: stessa regola già decisa per assignment/level — si
// congela alla tariffa del Livello nel momento in cui la riga viene creata
// (non ri-letta da un import futuro né da un cambio tariffa successivo).
//
// Upsert su (service_id, person_id, month) MA solo tra righe source='manual':
// ri-registrare lo stesso mese per la stessa persona/servizio corregge la
// riga esistente invece di sommarne una seconda (altrimenti le ore
// risulterebbero doppiate nei totali). Le righe da import CSV non vengono
// mai toccate da qui, stessa separazione già garantita in senso opposto
// dall'import (che non tocca mai le righe manuali).

export type TimeEntryFormValues = {
  serviceId: string;
  personId: string;
  month: string; // 'YYYY-MM'
  phaseId: string;
  hours: string;
};

export type TimeEntryFormState = {
  status: "idle" | "error" | "success";
  errors?: Partial<Record<keyof TimeEntryFormValues | "_form", string>>;
  values?: TimeEntryFormValues;
  createdServiceId?: string;
  createdPersonName?: string;
  wasUpdate?: boolean;
};

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function createTimeEntry(
  _prevState: TimeEntryFormState,
  formData: FormData
): Promise<TimeEntryFormState> {
  const session = await getSession();
  if (!session) {
    return { status: "error", errors: { _form: "Sessione scaduta — accedi di nuovo." } };
  }

  const values: TimeEntryFormValues = {
    serviceId: String(formData.get("serviceId") ?? ""),
    personId: String(formData.get("personId") ?? ""),
    month: String(formData.get("month") ?? ""),
    phaseId: String(formData.get("phaseId") ?? ""),
    hours: String(formData.get("hours") ?? ""),
  };

  const errors: TimeEntryFormState["errors"] = {};

  if (!values.serviceId) errors.serviceId = "Seleziona un servizio.";
  if (!values.personId) errors.personId = "Seleziona una persona.";
  if (!MONTH_RE.test(values.month)) errors.month = "Seleziona un mese valido.";

  const hours = Number(values.hours.replace(",", "."));
  if (values.hours === "" || Number.isNaN(hours) || hours < 0) {
    errors.hours = "Inserisci un numero di ore valido (0 o superiore).";
  }

  if (Object.keys(errors).length > 0) {
    return { status: "error", errors, values };
  }

  try {
    const result = await db.transaction().execute(async (trx) => {
      const person = await trx
        .selectFrom("person as p")
        .innerJoin("level as l", "l.id", "p.levelId")
        .select(["p.name", "l.internalCostRate"])
        .where("p.id", "=", values.personId)
        .executeTakeFirst();
      if (!person) throw new Error("PERSON_NOT_FOUND");

      const existing = await trx
        .selectFrom("timeEntry")
        .select(["id"])
        .where("serviceId", "=", values.serviceId)
        .where("personId", "=", values.personId)
        .where("month", "=", values.month)
        .where("source", "=", "manual")
        .executeTakeFirst();

      if (existing) {
        await trx
          .updateTable("timeEntry")
          .set({
            hours: hours.toFixed(2),
            phaseId: values.phaseId || null,
            updatedBy: session.personId,
          })
          .where("id", "=", existing.id)
          .execute();
      } else {
        await trx
          .insertInto("timeEntry")
          .values({
            serviceId: values.serviceId,
            personId: values.personId,
            month: values.month,
            phaseId: values.phaseId || null,
            hours: hours.toFixed(2),
            source: "manual",
            costRateSnapshot: person.internalCostRate,
            createdBy: session.personId,
            updatedBy: session.personId,
          })
          .execute();
      }

      return { personName: person.name, wasUpdate: !!existing };
    });

    return {
      status: "success",
      createdServiceId: values.serviceId,
      createdPersonName: result.personName,
      wasUpdate: result.wasUpdate,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "PERSON_NOT_FOUND") {
      return { status: "error", errors: { personId: "Persona non trovata." }, values };
    }
    return {
      status: "error",
      errors: { _form: "Errore imprevisto durante il salvataggio. Riprova." },
      values,
    };
  }
}
