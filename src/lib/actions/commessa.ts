"use server";

import { db } from "@/lib/db";
import type { CommessaStatus } from "@/lib/db/types";
import { getSession } from "@/lib/auth/dal";

export type CommessaFormValues = {
  code: string;
  clientMode: string;
  clientId: string;
  newClientName: string;
  newClientVat: string;
  assetName: string;
  clientContact: string;
  startDate: string;
  endDate: string;
  status: string;
  contractValue: string;
};

export type CommessaFormState = {
  status: "idle" | "error" | "success";
  errors?: Partial<Record<keyof CommessaFormValues | "_form", string>>;
  values?: CommessaFormValues;
  createdCode?: string;
};

const CODE_RE = /^\d{2}-\d{3}$/;
const STATUS_VALUES: CommessaStatus[] = ["offer", "active", "suspended", "closed", "lost"];

function isCommessaStatus(v: string): v is CommessaStatus {
  return (STATUS_VALUES as string[]).includes(v);
}

export async function createCommessa(
  _prevState: CommessaFormState,
  formData: FormData
): Promise<CommessaFormState> {
  const session = await getSession();
  if (!session) {
    return { status: "error", errors: { _form: "Sessione scaduta — accedi di nuovo." } };
  }

  const values: CommessaFormValues = {
    code: String(formData.get("code") ?? "").trim(),
    clientMode: String(formData.get("clientMode") ?? "existing"),
    clientId: String(formData.get("clientId") ?? ""),
    newClientName: String(formData.get("newClientName") ?? "").trim(),
    newClientVat: String(formData.get("newClientVat") ?? "").trim(),
    assetName: String(formData.get("assetName") ?? "").trim(),
    clientContact: String(formData.get("clientContact") ?? "").trim(),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    status: String(formData.get("status") ?? "active"),
    contractValue: String(formData.get("contractValue") ?? ""),
  };

  const errors: CommessaFormState["errors"] = {};

  if (!CODE_RE.test(values.code)) {
    errors.code = "Formato non valido — usa AA-NNN, es. 26-017.";
  }

  if (values.clientMode === "new") {
    if (!values.newClientName) {
      errors.newClientName = "Obbligatorio se crei un nuovo cliente.";
    }
  } else if (!values.clientId) {
    errors.clientId = "Seleziona un cliente.";
  }

  const contractValue = Number(values.contractValue.replace(",", "."));
  if (values.contractValue === "" || Number.isNaN(contractValue) || contractValue < 0) {
    errors.contractValue = "Inserisci un importo valido (0 o superiore).";
  }

  if (!isCommessaStatus(values.status)) {
    errors.status = "Stato non valido.";
  }

  if (values.startDate && values.endDate && values.endDate < values.startDate) {
    errors.endDate = "La fine prevista non può precedere la data di avvio.";
  }

  if (Object.keys(errors).length > 0) {
    return { status: "error", errors, values };
  }

  try {
    const created = await db.transaction().execute(async (trx) => {
      let clientId: string;

      if (values.clientMode === "new") {
        const client = await trx
          .insertInto("client")
          .values({
            name: values.newClientName,
            vatNumber: values.newClientVat || null,
            createdBy: session.personId,
            updatedBy: session.personId,
          })
          .returning("id")
          .executeTakeFirstOrThrow();
        clientId = client.id;
      } else {
        clientId = values.clientId;
      }

      return trx
        .insertInto("commessa")
        .values({
          code: values.code,
          clientId,
          assetName: values.assetName || null,
          clientContact: values.clientContact || null,
          startDate: values.startDate || null,
          endDate: values.endDate || null,
          status: values.status as CommessaStatus,
          contractValue: contractValue.toFixed(2),
          createdBy: session.personId,
          updatedBy: session.personId,
        })
        .returning(["id", "code"])
        .executeTakeFirstOrThrow();
    });

    return { status: "success", createdCode: created.code };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("commessa_code_key")) {
      return {
        status: "error",
        errors: { code: "Questo codice commessa esiste già." },
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
