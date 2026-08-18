"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/dal";
import type { SupplierCategory } from "@/lib/db/types";

const CATEGORY_VALUES: SupplierCategory[] = [
  "commissioning_agent",
  "testing_laboratory",
  "energy_modeler",
  "acoustics",
  "lighting",
  "iaq_survey",
  "water_analysis",
  "accessibility_surveyor",
  "external_technical_consultant",
  "esg_certification_body",
  "other",
];
function isSupplierCategory(v: string): v is SupplierCategory {
  return (CATEGORY_VALUES as string[]).includes(v);
}

export type SupplierFormValues = {
  id: string;
  code: string;
  name: string;
  category: string;
  contactName: string;
  email: string;
  phone: string;
  paymentTerms: string;
  vatNumber: string;
  notes: string;
};

export type SupplierFormState = {
  status: "idle" | "error" | "success";
  errors?: Partial<Record<keyof SupplierFormValues | "_form", string>>;
  values?: SupplierFormValues;
};

export async function saveSupplier(
  _prevState: SupplierFormState,
  formData: FormData
): Promise<SupplierFormState> {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return { status: "error", errors: { _form: "Non autorizzato." } };
  }

  const values: SupplierFormValues = {
    id: String(formData.get("id") ?? ""),
    code: String(formData.get("code") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    category: String(formData.get("category") ?? ""),
    contactName: String(formData.get("contactName") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    paymentTerms: String(formData.get("paymentTerms") ?? "").trim(),
    vatNumber: String(formData.get("vatNumber") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
  };

  const errors: SupplierFormState["errors"] = {};
  if (!values.code) errors.code = "Obbligatorio.";
  if (!values.name) errors.name = "Obbligatorio.";
  if (!isSupplierCategory(values.category)) errors.category = "Seleziona una categoria.";

  if (Object.keys(errors).length > 0) return { status: "error", errors, values };

  const payload = {
    code: values.code,
    name: values.name,
    category: values.category as SupplierCategory,
    contactName: values.contactName || null,
    email: values.email || null,
    phone: values.phone || null,
    paymentTerms: values.paymentTerms || null,
    vatNumber: values.vatNumber || null,
    notes: values.notes || null,
    updatedBy: session.personId,
  };

  try {
    if (values.id) {
      await db.updateTable("supplier").set(payload).where("id", "=", values.id).execute();
    } else {
      await db.insertInto("supplier").values({ ...payload, createdBy: session.personId }).execute();
    }
    return { status: "success" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("supplier_code_key")) {
      return { status: "error", errors: { code: "Esiste già un fornitore con questo codice." }, values };
    }
    return { status: "error", errors: { _form: "Errore imprevisto. Riprova." }, values };
  }
}
