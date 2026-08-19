"use server";

import { db } from "@/lib/db";
import type { CommessaStatus } from "@/lib/db/types";
import { getSession } from "@/lib/auth/dal";
import { geocodeAddress } from "@/lib/geocode";

export type CommessaFormValues = {
  code: string;
  clientMode: string;
  clientId: string;
  newClientName: string;
  newClientVat: string;
  assetName: string;
  address: string;
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
  /** L'indirizzo è stato salvato ma non trovato dal geocoding (§ sotto) —
   * niente coordinate sulla mappa per questa commessa, non blocca il resto. */
  geocodeFailed?: boolean;
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
    address: String(formData.get("address") ?? "").trim(),
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

  // Geocodifica fuori dalla transazione: è una chiamata di rete a un
  // servizio esterno (Nominatim/OpenStreetMap, §11) — non deve tenere aperta
  // una transazione database mentre aspetta una risposta HTTP.
  const geocoded = values.address ? await geocodeAddress(values.address) : null;

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
          address: values.address || null,
          latitude: geocoded ? geocoded.latitude.toFixed(6) : null,
          longitude: geocoded ? geocoded.longitude.toFixed(6) : null,
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

    return {
      status: "success",
      createdCode: created.code,
      geocodeFailed: !!values.address && !geocoded,
    };
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

// Modifica di una commessa già esistente. Il codice è l'identità della
// commessa (i codici servizio ne dipendono, "{commessa.code}-{lettera}") —
// non si tocca da qui, stessa scelta già fatta per il servizio. Il cliente
// invece è modificabile: qui non c'è un formato di codice che lo lega,
// solo un riferimento — utile per correggere un cliente sbagliato in fase
// di creazione.

export type CommessaEditFormValues = {
  id: string;
  clientId: string;
  assetName: string;
  address: string;
  clientContact: string;
  startDate: string;
  endDate: string;
  status: string;
  contractValue: string;
};

export type CommessaEditFormState = {
  status: "idle" | "error" | "success";
  errors?: Partial<Record<keyof CommessaEditFormValues | "_form", string>>;
  values?: CommessaEditFormValues;
  geocodeFailed?: boolean;
};

export async function updateCommessa(
  _prevState: CommessaEditFormState,
  formData: FormData
): Promise<CommessaEditFormState> {
  const session = await getSession();
  if (!session) {
    return { status: "error", errors: { _form: "Sessione scaduta — accedi di nuovo." } };
  }

  const values: CommessaEditFormValues = {
    id: String(formData.get("id") ?? ""),
    clientId: String(formData.get("clientId") ?? ""),
    assetName: String(formData.get("assetName") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    clientContact: String(formData.get("clientContact") ?? "").trim(),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    status: String(formData.get("status") ?? "active"),
    contractValue: String(formData.get("contractValue") ?? ""),
  };

  const errors: CommessaEditFormState["errors"] = {};

  if (!values.id) errors._form = "Commessa non specificata.";
  if (!values.clientId) errors.clientId = "Seleziona un cliente.";

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
    // Ri-geocodifica solo se l'indirizzo è cambiato — evita una chiamata di
    // rete inutile ad ogni singolo salvataggio della maschera (es. se si sta
    // solo correggendo il valore contratto). Se l'indirizzo viene svuotato,
    // anche le coordinate si svuotano.
    const current = await db
      .selectFrom("commessa")
      .select(["address", "latitude", "longitude"])
      .where("id", "=", values.id)
      .executeTakeFirst();

    let latitude = current?.latitude ?? null;
    let longitude = current?.longitude ?? null;
    let geocodeFailed = false;

    if (values.address !== (current?.address ?? "")) {
      if (!values.address) {
        latitude = null;
        longitude = null;
      } else {
        const geocoded = await geocodeAddress(values.address);
        if (geocoded) {
          latitude = geocoded.latitude.toFixed(6);
          longitude = geocoded.longitude.toFixed(6);
        } else {
          latitude = null;
          longitude = null;
          geocodeFailed = true;
        }
      }
    }

    await db
      .updateTable("commessa")
      .set({
        clientId: values.clientId,
        assetName: values.assetName || null,
        address: values.address || null,
        latitude,
        longitude,
        clientContact: values.clientContact || null,
        startDate: values.startDate || null,
        endDate: values.endDate || null,
        status: values.status as CommessaStatus,
        contractValue: contractValue.toFixed(2),
        updatedBy: session.personId,
      })
      .where("id", "=", values.id)
      .execute();

    return { status: "success", geocodeFailed };
  } catch {
    return {
      status: "error",
      errors: { _form: "Errore imprevisto durante il salvataggio. Riprova." },
      values,
    };
  }
}
