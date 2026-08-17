"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/dal";

//
// baseline_date, §4.2: "set once and must never change afterwards". Questa
// action la scrive SOLO se la fase non ha ancora una baseline confermata
// (baseline_confirmed = false) — controllato lato server dentro la stessa
// transazione, non fidandosi del form: anche se qualcuno manda comunque un
// valore per una fase già confermata, viene ignorato.

export type PhaseFormValues = {
  phaseId: string;
  ownerId: string;
  plannedDate: string;
  actualDate: string;
  progressPct: string; // 0-100 come inserito dall'utente
  baselineDate: string; // usato solo se la baseline non è ancora confermata
};

export type PhaseFormState = {
  status: "idle" | "error" | "success";
  errors?: Partial<Record<keyof PhaseFormValues | "_form", string>>;
  values?: PhaseFormValues;
  updatedName?: string;
  updatedServiceId?: string;
};

export async function updatePhaseProgress(
  _prevState: PhaseFormState,
  formData: FormData
): Promise<PhaseFormState> {
  const session = await getSession();
  if (!session) {
    return { status: "error", errors: { _form: "Sessione scaduta — accedi di nuovo." } };
  }

  const values: PhaseFormValues = {
    phaseId: String(formData.get("phaseId") ?? ""),
    ownerId: String(formData.get("ownerId") ?? ""),
    plannedDate: String(formData.get("plannedDate") ?? ""),
    actualDate: String(formData.get("actualDate") ?? ""),
    progressPct: String(formData.get("progressPct") ?? ""),
    baselineDate: String(formData.get("baselineDate") ?? ""),
  };

  const errors: PhaseFormState["errors"] = {};

  if (!values.phaseId) errors.phaseId = "Seleziona una fase.";

  const progressPct = Number(values.progressPct.replace(",", "."));
  if (values.progressPct === "" || Number.isNaN(progressPct) || progressPct < 0 || progressPct > 100) {
    errors.progressPct = "Inserisci un valore tra 0 e 100.";
  }

  if (Object.keys(errors).length > 0) {
    return { status: "error", errors, values };
  }

  try {
    const result = await db.transaction().execute(async (trx) => {
      const phase = await trx
        .selectFrom("phase")
        .select(["id", "name", "serviceId", "baselineConfirmed"])
        .where("id", "=", values.phaseId)
        .executeTakeFirst();
      if (!phase) throw new Error("PHASE_NOT_FOUND");

      const updateValues: {
        ownerId: string | null;
        plannedDate: string | null;
        actualDate: string | null;
        progressPct: string;
        updatedBy: string;
        baselineDate?: string;
        baselineConfirmed?: boolean;
      } = {
        ownerId: values.ownerId || null,
        plannedDate: values.plannedDate || null,
        actualDate: values.actualDate || null,
        progressPct: (progressPct / 100).toFixed(4),
        updatedBy: session.personId,
      };

      if (!phase.baselineConfirmed && values.baselineDate) {
        updateValues.baselineDate = values.baselineDate;
        updateValues.baselineConfirmed = true;
      }

      await trx.updateTable("phase").set(updateValues).where("id", "=", values.phaseId).execute();

      return { name: phase.name, serviceId: phase.serviceId };
    });

    return { status: "success", updatedName: result.name, updatedServiceId: result.serviceId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "PHASE_NOT_FOUND") {
      return { status: "error", errors: { phaseId: "Fase non trovata." }, values };
    }
    return {
      status: "error",
      errors: { _form: "Errore imprevisto durante il salvataggio. Riprova." },
      values,
    };
  }
}
