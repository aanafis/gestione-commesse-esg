"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/dal";
import type { PersonRole } from "@/lib/db/types";

// Gestione persone (§6.6). L'email qui è anche la chiave della whitelist di
// accesso (§7): disattivare una persona qui le chiude l'accesso subito
// (verificato da getSession(), non solo alla scadenza del cookie).

export type PersonFormValues = {
  id: string;
  name: string;
  email: string;
  levelId: string;
  role: string;
  active: string;
  annualAvailableHours: string;
};

export type PersonFormState = {
  status: "idle" | "error" | "success";
  errors?: Partial<Record<keyof PersonFormValues | "_form", string>>;
  values?: PersonFormValues;
};

const ROLE_VALUES: PersonRole[] = ["admin", "member"];
function isPersonRole(v: string): v is PersonRole {
  return (ROLE_VALUES as string[]).includes(v);
}

export async function savePerson(
  _prevState: PersonFormState,
  formData: FormData
): Promise<PersonFormState> {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return { status: "error", errors: { _form: "Non autorizzato." } };
  }

  const values: PersonFormValues = {
    id: String(formData.get("id") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    levelId: String(formData.get("levelId") ?? ""),
    role: String(formData.get("role") ?? "member"),
    active: String(formData.get("active") ?? "true"),
    annualAvailableHours: String(formData.get("annualAvailableHours") ?? "1600"),
  };

  const errors: PersonFormState["errors"] = {};
  if (!values.name) errors.name = "Obbligatorio.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = "Email non valida.";
  if (!values.levelId) errors.levelId = "Seleziona un livello.";
  if (!isPersonRole(values.role)) errors.role = "Ruolo non valido.";
  const hours = Number(values.annualAvailableHours.replace(",", "."));
  if (Number.isNaN(hours) || hours < 0) errors.annualAvailableHours = "Numero di ore non valido.";

  // Un admin non può disattivare se stesso o rimuoversi il ruolo admin da
  // questo form — evita di restare tutti fuori dall'Admin per errore.
  if (values.id === session.personId) {
    if (values.active === "false") errors.active = "Non puoi disattivare il tuo stesso account.";
    if (values.role !== "admin") errors.role = "Non puoi rimuoverti il ruolo di amministratore da qui.";
  }

  if (Object.keys(errors).length > 0) {
    return { status: "error", errors, values };
  }

  const payload = {
    name: values.name,
    email: values.email,
    levelId: values.levelId,
    role: values.role as PersonRole,
    active: values.active === "true",
    annualAvailableHours: hours.toFixed(2),
    updatedBy: session.personId,
  };

  try {
    if (values.id) {
      await db.updateTable("person").set(payload).where("id", "=", values.id).execute();
    } else {
      await db.insertInto("person").values({ ...payload, createdBy: session.personId }).execute();
    }
    return { status: "success" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("person_email_key")) {
      return { status: "error", errors: { email: "Esiste già una persona con questa email." }, values };
    }
    return { status: "error", errors: { _form: "Errore imprevisto. Riprova." }, values };
  }
}
