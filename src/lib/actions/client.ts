"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/dal";

export type ClientFormValues = {
  id: string;
  name: string;
  vatNumber: string;
  notes: string;
};

export type ClientFormState = {
  status: "idle" | "error" | "success";
  errors?: Partial<Record<keyof ClientFormValues | "_form", string>>;
  values?: ClientFormValues;
};

export async function saveClient(
  _prevState: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return { status: "error", errors: { _form: "Non autorizzato." } };
  }

  const values: ClientFormValues = {
    id: String(formData.get("id") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
    vatNumber: String(formData.get("vatNumber") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
  };

  const errors: ClientFormState["errors"] = {};
  if (!values.name) errors.name = "Obbligatorio.";
  if (Object.keys(errors).length > 0) return { status: "error", errors, values };

  const payload = {
    name: values.name,
    vatNumber: values.vatNumber || null,
    notes: values.notes || null,
    updatedBy: session.personId,
  };

  if (values.id) {
    await db.updateTable("client").set(payload).where("id", "=", values.id).execute();
  } else {
    await db.insertInto("client").values({ ...payload, createdBy: session.personId }).execute();
  }
  return { status: "success" };
}
