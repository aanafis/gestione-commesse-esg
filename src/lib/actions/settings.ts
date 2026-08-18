"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/dal";

export type SettingsFormValues = {
  defaultMarkup: string;
  pmApprovalThreshold: string;
  directorApprovalThreshold: string;
  hoursAlertThreshold: string;
  maxAcceptableDiscount: string;
  paymentTermsDays: string;
};

export type SettingsFormState = {
  status: "idle" | "error" | "success";
  errors?: Partial<Record<keyof SettingsFormValues | "_form", string>>;
  values?: SettingsFormValues;
};

function parseNum(raw: string): number {
  return Number(raw.replace(",", "."));
}

export async function updateSettings(
  _prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return { status: "error", errors: { _form: "Non autorizzato." } };
  }

  const values: SettingsFormValues = {
    defaultMarkup: String(formData.get("defaultMarkup") ?? ""),
    pmApprovalThreshold: String(formData.get("pmApprovalThreshold") ?? ""),
    directorApprovalThreshold: String(formData.get("directorApprovalThreshold") ?? ""),
    hoursAlertThreshold: String(formData.get("hoursAlertThreshold") ?? ""),
    maxAcceptableDiscount: String(formData.get("maxAcceptableDiscount") ?? ""),
    paymentTermsDays: String(formData.get("paymentTermsDays") ?? ""),
  };

  const errors: SettingsFormState["errors"] = {};
  const defaultMarkup = parseNum(values.defaultMarkup);
  if (Number.isNaN(defaultMarkup) || defaultMarkup <= 0) errors.defaultMarkup = "Deve essere maggiore di 0.";
  const pmThreshold = parseNum(values.pmApprovalThreshold);
  if (Number.isNaN(pmThreshold) || pmThreshold < 0) errors.pmApprovalThreshold = "Importo non valido.";
  const directorThreshold = parseNum(values.directorApprovalThreshold);
  if (Number.isNaN(directorThreshold) || directorThreshold < 0) {
    errors.directorApprovalThreshold = "Importo non valido.";
  } else if (!errors.pmApprovalThreshold && directorThreshold < pmThreshold) {
    errors.directorApprovalThreshold = "Deve essere maggiore o uguale alla soglia PM.";
  }
  const hoursAlert = parseNum(values.hoursAlertThreshold);
  if (Number.isNaN(hoursAlert) || hoursAlert < 0 || hoursAlert > 1) {
    errors.hoursAlertThreshold = "Inserisci una frazione tra 0 e 1 (es. 0.85 = 85%).";
  }
  const maxDiscount = parseNum(values.maxAcceptableDiscount);
  if (Number.isNaN(maxDiscount) || maxDiscount < 0 || maxDiscount > 1) {
    errors.maxAcceptableDiscount = "Inserisci una frazione tra 0 e 1 (es. 0.10 = 10%).";
  }
  const paymentDays = parseInt(values.paymentTermsDays, 10);
  if (Number.isNaN(paymentDays) || paymentDays < 0) errors.paymentTermsDays = "Numero di giorni non valido.";

  if (Object.keys(errors).length > 0) {
    return { status: "error", errors, values };
  }

  await db
    .updateTable("settings")
    .set({
      defaultMarkup: defaultMarkup.toFixed(4),
      pmApprovalThreshold: pmThreshold.toFixed(2),
      directorApprovalThreshold: directorThreshold.toFixed(2),
      hoursAlertThreshold: hoursAlert.toFixed(4),
      maxAcceptableDiscount: maxDiscount.toFixed(4),
      paymentTermsDays: paymentDays,
      updatedBy: session.personId,
    })
    .where("id", "=", 1)
    .execute();

  return { status: "success" };
}
