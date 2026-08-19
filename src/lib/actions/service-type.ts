"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/dal";

// Tipi di servizio (§4.1) — richiesta dall'utente: poterne aggiungere di
// nuovi in autonomia (LEED, WELL, CRREM... l'elenco granulare cresce nel
// tempo) senza dover intervenire sul database. Creazione e modifica nella
// stessa azione (id vuoto = crea), stesso pattern di saveLevel.

export type ServiceTypeFormValues = {
  id: string;
  name: string;
  sortOrder: string;
  active: string;
};

export type ServiceTypeFormState = {
  status: "idle" | "error" | "success";
  errors?: Partial<Record<keyof ServiceTypeFormValues | "_form", string>>;
  values?: ServiceTypeFormValues;
  savedId?: string;
};

async function requireAdminSession() {
  const session = await getSession();
  if (!session || session.role !== "admin") return null;
  return session;
}

export async function saveServiceType(
  _prevState: ServiceTypeFormState,
  formData: FormData
): Promise<ServiceTypeFormState> {
  const session = await requireAdminSession();
  if (!session) return { status: "error", errors: { _form: "Non autorizzato." } };

  const values: ServiceTypeFormValues = {
    id: String(formData.get("id") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
    sortOrder: String(formData.get("sortOrder") ?? "0"),
    active: String(formData.get("active") ?? "true"),
  };

  const errors: ServiceTypeFormState["errors"] = {};
  if (!values.name) errors.name = "Obbligatorio.";
  const sortOrder = parseInt(values.sortOrder, 10);
  if (Number.isNaN(sortOrder)) errors.sortOrder = "Numero d'ordine non valido.";

  if (Object.keys(errors).length > 0) {
    return { status: "error", errors, values };
  }

  const payload = {
    name: values.name,
    sortOrder,
    active: values.active === "true",
  };

  try {
    if (values.id) {
      await db.updateTable("serviceType").set(payload).where("id", "=", values.id).execute();
      return { status: "success", savedId: values.id };
    }

    const created = await db
      .insertInto("serviceType")
      .values(payload)
      .returning("id")
      .executeTakeFirstOrThrow();
    return { status: "success", savedId: created.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("service_type_name_key")) {
      return { status: "error", errors: { name: "Esiste già un tipo di servizio con questo nome." }, values };
    }
    return { status: "error", errors: { _form: "Errore imprevisto. Riprova." }, values };
  }
}
