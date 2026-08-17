"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/dal";

// §3: "Do not auto-calculate ETC as estimated − actual." Il suggerimento
// MAX(0, stimate-consuntivo) vive solo nel form, accanto al campo — non
// tocca mai questa action, che riceve sempre e solo il giudizio inserito
// dalla persona.
//
// "Saving a new forecast sets is_current = false on prior rows for the
// same (service, person)": fatto qui dentro la stessa transazione
// dell'INSERT, non con un trigger — così la cronologia resta leggibile
// (chi ha superseduto cosa e quando è nell'ordine di recorded_at).
//
// recorded_by_id ora viene dalla sessione, non più da una scelta manuale
// nel form: prima dell'autenticazione era l'unico modo di sapere chi
// registrava il giudizio, ora lo sappiamo per davvero.

export type ForecastFormValues = {
  serviceId: string;
  personId: string;
  quarter: string;
  etcHours: string;
  notes: string;
};

export type ForecastFormState = {
  status: "idle" | "error" | "success";
  errors?: Partial<Record<keyof ForecastFormValues | "_form", string>>;
  values?: ForecastFormValues;
  createdServiceId?: string;
};

const QUARTER_RE = /^\d{4}-Q[1-4]$/;

export async function createHoursForecast(
  _prevState: ForecastFormState,
  formData: FormData
): Promise<ForecastFormState> {
  const session = await getSession();
  if (!session) {
    return { status: "error", errors: { _form: "Sessione scaduta — accedi di nuovo." } };
  }

  const values: ForecastFormValues = {
    serviceId: String(formData.get("serviceId") ?? ""),
    personId: String(formData.get("personId") ?? ""),
    quarter: String(formData.get("quarter") ?? ""),
    etcHours: String(formData.get("etcHours") ?? ""),
    notes: String(formData.get("notes") ?? "").trim(),
  };

  const errors: ForecastFormState["errors"] = {};

  if (!values.serviceId || !values.personId) errors.serviceId = "Seleziona una coppia servizio/persona.";
  if (!QUARTER_RE.test(values.quarter)) errors.quarter = "Formato non valido — usa AAAA-Qn, es. 2026-Q3.";

  const etcHours = Number(values.etcHours.replace(",", "."));
  if (values.etcHours === "" || Number.isNaN(etcHours) || etcHours < 0) {
    errors.etcHours = "Inserisci un numero di ore valido (0 o superiore).";
  }

  if (Object.keys(errors).length > 0) {
    return { status: "error", errors, values };
  }

  try {
    await db.transaction().execute(async (trx) => {
      const assignment = await trx
        .selectFrom("assignment")
        .select("id")
        .where("serviceId", "=", values.serviceId)
        .where("personId", "=", values.personId)
        .executeTakeFirst();
      if (!assignment) throw new Error("ASSIGNMENT_NOT_FOUND");

      await trx
        .updateTable("hoursForecast")
        .set({ isCurrent: false })
        .where("serviceId", "=", values.serviceId)
        .where("personId", "=", values.personId)
        .where("isCurrent", "=", true)
        .execute();

      await trx
        .insertInto("hoursForecast")
        .values({
          quarter: values.quarter,
          serviceId: values.serviceId,
          personId: values.personId,
          etcHours: etcHours.toFixed(2),
          isCurrent: true,
          recordedById: session.personId,
          notes: values.notes || null,
        })
        .execute();
    });

    return { status: "success", createdServiceId: values.serviceId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "ASSIGNMENT_NOT_FOUND") {
      return {
        status: "error",
        errors: { serviceId: "Questa persona non risulta assegnata a questo servizio." },
        values,
      };
    }
    return {
      status: "error",
      errors: { _form: "Errore imprevisto durante il salvataggio. Riprova." },
      values,
    };
  }
}
