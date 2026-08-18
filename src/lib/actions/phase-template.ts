"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/dal";

// §4.1: hours_quota_pct deve sommare a 1.0 per template — controllo
// applicativo (mostrato nella pagina di elenco), non un vincolo rigido di
// database: durante la modifica riga per riga la somma può essere
// temporaneamente sbilanciata.

export type PhaseTemplateFormValues = {
  id: string;
  phaseName: string;
  expectedDeliverable: string;
  contractualMilestone: string;
  durationDays: string;
  hoursQuotaPct: string;
  sortOrder: string;
};

export type PhaseTemplateFormState = {
  status: "idle" | "error" | "success";
  errors?: Partial<Record<keyof PhaseTemplateFormValues | "_form", string>>;
  values?: PhaseTemplateFormValues;
  templateName?: string;
};

export async function savePhaseTemplateRow(
  _prevState: PhaseTemplateFormState,
  formData: FormData
): Promise<PhaseTemplateFormState> {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return { status: "error", errors: { _form: "Non autorizzato." } };
  }

  const values: PhaseTemplateFormValues = {
    id: String(formData.get("id") ?? ""),
    phaseName: String(formData.get("phaseName") ?? "").trim(),
    expectedDeliverable: String(formData.get("expectedDeliverable") ?? "").trim(),
    contractualMilestone: String(formData.get("contractualMilestone") ?? "false"),
    durationDays: String(formData.get("durationDays") ?? ""),
    hoursQuotaPct: String(formData.get("hoursQuotaPct") ?? ""),
    sortOrder: String(formData.get("sortOrder") ?? ""),
  };

  const errors: PhaseTemplateFormState["errors"] = {};
  if (!values.phaseName) errors.phaseName = "Obbligatorio.";
  const duration = parseInt(values.durationDays, 10);
  if (Number.isNaN(duration) || duration < 0) errors.durationDays = "Numero di giorni non valido.";
  const quota = Number(values.hoursQuotaPct.replace(",", "."));
  if (Number.isNaN(quota) || quota < 0 || quota > 1) errors.hoursQuotaPct = "Inserisci una frazione tra 0 e 1 (es. 0.15 = 15%).";
  const sortOrder = parseInt(values.sortOrder, 10);
  if (Number.isNaN(sortOrder) || sortOrder < 1) errors.sortOrder = "Numero d'ordine non valido.";

  if (Object.keys(errors).length > 0) {
    return { status: "error", errors, values };
  }

  const row = await db
    .updateTable("phaseTemplate")
    .set({
      phaseName: values.phaseName,
      expectedDeliverable: values.expectedDeliverable || null,
      contractualMilestone: values.contractualMilestone === "true",
      durationDays: duration,
      hoursQuotaPct: quota.toFixed(4),
      sortOrder,
      updatedBy: session.personId,
    })
    .where("id", "=", values.id)
    .returning("templateName")
    .executeTakeFirstOrThrow();

  return { status: "success", templateName: row.templateName };
}
