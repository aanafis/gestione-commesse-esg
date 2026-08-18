"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/dal";

// Listino tariffe (§4.1, §7 — dati sensibili quasi-salariali sotto GDPR).
// Le tariffe non sono uno snapshot qui: sono LA fonte che assignment/
// time_entry copiano al momento della creazione (cost_rate_snapshot).
// Cambiarle qui non altera nulla di già registrato — solo le prossime
// assegnazioni useranno il nuovo valore.

export type LevelFormValues = {
  id: string;
  name: string;
  internalCostRate: string;
  soldRate: string;
  active: string;
};

export type LevelFormState = {
  status: "idle" | "error" | "success";
  errors?: Partial<Record<keyof LevelFormValues | "_form", string>>;
  values?: LevelFormValues;
};

function parseNum(raw: string): number {
  return Number(raw.replace(",", "."));
}

async function requireAdminSession() {
  const session = await getSession();
  if (!session || session.role !== "admin") return null;
  return session;
}

export async function saveLevel(
  _prevState: LevelFormState,
  formData: FormData
): Promise<LevelFormState> {
  const session = await requireAdminSession();
  if (!session) return { status: "error", errors: { _form: "Non autorizzato." } };

  const values: LevelFormValues = {
    id: String(formData.get("id") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
    internalCostRate: String(formData.get("internalCostRate") ?? ""),
    soldRate: String(formData.get("soldRate") ?? ""),
    active: String(formData.get("active") ?? "true"),
  };

  const errors: LevelFormState["errors"] = {};
  if (!values.name) errors.name = "Obbligatorio.";
  const cost = parseNum(values.internalCostRate);
  if (Number.isNaN(cost) || cost < 0) errors.internalCostRate = "Importo non valido.";
  const sold = parseNum(values.soldRate);
  if (Number.isNaN(sold) || sold < 0) errors.soldRate = "Importo non valido.";

  if (Object.keys(errors).length > 0) {
    return { status: "error", errors, values };
  }

  const payload = {
    name: values.name,
    internalCostRate: cost.toFixed(2),
    soldRate: sold.toFixed(2),
    active: values.active === "true",
    updatedBy: session.personId,
  };

  try {
    if (values.id) {
      await db.updateTable("level").set(payload).where("id", "=", values.id).execute();
    } else {
      await db.insertInto("level").values({ ...payload, createdBy: session.personId }).execute();
    }
    return { status: "success" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("level_name_key")) {
      return { status: "error", errors: { name: "Esiste già un livello con questo nome." }, values };
    }
    return { status: "error", errors: { _form: "Errore imprevisto. Riprova." }, values };
  }
}
