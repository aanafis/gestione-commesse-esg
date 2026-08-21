"use server";

import { db } from "@/lib/db";
import type { PoStatus } from "@/lib/db/types";
import { getSession } from "@/lib/auth/dal";

//
// §8, regola non negoziabile #3: "No supplier work without a purchase
// order." Un ordine conta come costo impegnato solo da status 'issued' in
// su (v_purchase_order_line_metrics.is_committed) — questa action non lo
// impone (lo stato lo sceglie l'utente), ma è il motivo per cui l'ordine va
// registrato qui prima che il lavoro cominci, non quando arriva la fattura.

export type PurchaseOrderLineInput = {
  serviceId: string;
  phaseRef: string;
  description: string;
  consultantCost: string;
  rechargedToClient: string;
  invoicedAmount: string;
};

export type PurchaseOrderFormValues = {
  number: string;
  supplierId: string;
  description: string;
  status: string;
  issueDate: string;
  expectedDeliveryDate: string;
  approverId: string;
  notes: string;
  linesJson: string;
};

export type PurchaseOrderFormState = {
  status: "idle" | "error" | "success";
  errors?: Partial<Record<keyof PurchaseOrderFormValues | "_form", string>> & {
    lines?: Record<number, Partial<Record<keyof PurchaseOrderLineInput, string>>>;
  };
  values?: PurchaseOrderFormValues;
  createdId?: string;
  createdNumber?: string;
  createdSupplierId?: string;
  approvalLevel?: string;
};

const PO_STATUS_VALUES: PoStatus[] = [
  "requested",
  "approved",
  "issued",
  "delivered",
  "invoiced",
  "paid",
  "cancelled",
];

function isPoStatus(v: string): v is PoStatus {
  return (PO_STATUS_VALUES as string[]).includes(v);
}

function parseMoney(raw: string): number {
  return Number((raw || "0").replace(",", "."));
}

export async function createPurchaseOrder(
  _prevState: PurchaseOrderFormState,
  formData: FormData
): Promise<PurchaseOrderFormState> {
  const session = await getSession();
  if (!session) {
    return { status: "error", errors: { _form: "Sessione scaduta — accedi di nuovo." } };
  }

  const values: PurchaseOrderFormValues = {
    number: String(formData.get("number") ?? "").trim(),
    supplierId: String(formData.get("supplierId") ?? ""),
    description: String(formData.get("description") ?? "").trim(),
    status: String(formData.get("status") ?? "requested"),
    issueDate: String(formData.get("issueDate") ?? ""),
    expectedDeliveryDate: String(formData.get("expectedDeliveryDate") ?? ""),
    approverId: String(formData.get("approverId") ?? ""),
    notes: String(formData.get("notes") ?? "").trim(),
    linesJson: String(formData.get("linesJson") ?? "[]"),
  };

  const errors: PurchaseOrderFormState["errors"] = {};

  if (!values.number) errors.number = "Obbligatorio.";
  if (!values.supplierId) errors.supplierId = "Seleziona un fornitore.";
  if (!isPoStatus(values.status)) errors.status = "Stato non valido.";
  if (
    values.issueDate &&
    values.expectedDeliveryDate &&
    values.expectedDeliveryDate < values.issueDate
  ) {
    errors.expectedDeliveryDate = "La consegna prevista non può precedere l'emissione.";
  }

  let lines: PurchaseOrderLineInput[] = [];
  try {
    lines = JSON.parse(values.linesJson);
    if (!Array.isArray(lines)) throw new Error("not an array");
  } catch {
    errors._form = "Righe dell'ordine non valide. Ricarica la pagina e riprova.";
  }

  const lineErrors: NonNullable<PurchaseOrderFormState["errors"]>["lines"] = {};
  if (!errors._form) {
    if (lines.length === 0) {
      errors._form = "Aggiungi almeno una riga (servizio + costo consulente).";
    }
    lines.forEach((line, i) => {
      const lineErr: Partial<Record<keyof PurchaseOrderLineInput, string>> = {};
      if (!line.serviceId) lineErr.serviceId = "Seleziona un servizio.";
      const cost = parseMoney(line.consultantCost);
      if (line.consultantCost === "" || Number.isNaN(cost) || cost < 0) {
        lineErr.consultantCost = "Importo valido richiesto (0 o superiore).";
      }
      const recharged = parseMoney(line.rechargedToClient || "0");
      if (Number.isNaN(recharged) || recharged < 0) lineErr.rechargedToClient = "Importo non valido.";
      const invoiced = parseMoney(line.invoicedAmount || "0");
      if (Number.isNaN(invoiced) || invoiced < 0) lineErr.invoicedAmount = "Importo non valido.";
      if (Object.keys(lineErr).length > 0) lineErrors[i] = lineErr;
    });
    if (Object.keys(lineErrors).length > 0) errors.lines = lineErrors;
  }

  if (Object.keys(errors).length > 0) {
    return { status: "error", errors, values };
  }

  try {
    const result = await db.transaction().execute(async (trx) => {
      const po = await trx
        .insertInto("purchaseOrder")
        .values({
          number: values.number,
          supplierId: values.supplierId,
          description: values.description || null,
          status: values.status as PoStatus,
          issueDate: values.issueDate || null,
          expectedDeliveryDate: values.expectedDeliveryDate || null,
          approverId: values.approverId || null,
          notes: values.notes || null,
          createdBy: session.personId,
          updatedBy: session.personId,
        })
        .returning(["id", "number"])
        .executeTakeFirstOrThrow();

      for (const line of lines) {
        await trx
          .insertInto("purchaseOrderLine")
          .values({
            purchaseOrderId: po.id,
            serviceId: line.serviceId,
            phaseRef: line.phaseRef || null,
            description: line.description || null,
            consultantCost: parseMoney(line.consultantCost).toFixed(2),
            rechargedToClient: parseMoney(line.rechargedToClient || "0").toFixed(2),
            invoicedAmount: parseMoney(line.invoicedAmount || "0").toFixed(2),
            createdBy: session.personId,
            updatedBy: session.personId,
          })
          .execute();
      }

      const summary = await trx
        .selectFrom("vPurchaseOrderSummary")
        .select("approvalLevel")
        .where("purchaseOrderId", "=", po.id)
        .executeTakeFirst();

      return { id: po.id, number: po.number, approvalLevel: summary?.approvalLevel ?? null };
    });

    return {
      status: "success",
      createdId: result.id,
      createdNumber: result.number,
      createdSupplierId: values.supplierId,
      approvalLevel: result.approvalLevel ?? undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("purchase_order_number_key")) {
      return {
        status: "error",
        errors: {
          number:
            "Questo numero ordine esiste già. Per aggiungere un altro servizio allo stesso ordine, apri l'ordine esistente e aggiungi una riga da lì — non crearne uno nuovo con lo stesso numero.",
        },
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

// Modifica di un ordine già esistente (richiesta dall'utente): aggiungere un
// servizio a un ordine emesso è aggiungere una riga QUI, non crearne uno
// nuovo con lo stesso numero — il vincolo UNIQUE su number lo impedisce di
// proposito (un numero ordine identifica un solo documento). Le righe si
// sincronizzano per differenza: quelle inviate con un id vengono aggiornate,
// quelle senza id sono nuove (inserite), quelle esistenti nel database ma
// non più presenti nell'invio vengono cancellate — a meno che abbiano già
// del fatturato registrato (invoicedAmount > 0): quello è un evento fiscale
// reale, cancellare la riga non lo annullerebbe nella realtà.

export type PurchaseOrderEditLineInput = PurchaseOrderLineInput & { lineId: string };

export type PurchaseOrderEditFormValues = {
  id: string;
  number: string;
  supplierId: string;
  description: string;
  status: string;
  issueDate: string;
  expectedDeliveryDate: string;
  approverId: string;
  notes: string;
  linesJson: string;
};

export type PurchaseOrderEditFormState = {
  status: "idle" | "error" | "success";
  errors?: Partial<Record<keyof PurchaseOrderEditFormValues | "_form", string>> & {
    lines?: Record<number, Partial<Record<keyof PurchaseOrderLineInput, string>>>;
  };
  values?: PurchaseOrderEditFormValues;
  updatedSupplierId?: string;
};

export async function updatePurchaseOrder(
  _prevState: PurchaseOrderEditFormState,
  formData: FormData
): Promise<PurchaseOrderEditFormState> {
  const session = await getSession();
  if (!session) {
    return { status: "error", errors: { _form: "Sessione scaduta — accedi di nuovo." } };
  }

  const values: PurchaseOrderEditFormValues = {
    id: String(formData.get("id") ?? ""),
    number: String(formData.get("number") ?? "").trim(),
    supplierId: String(formData.get("supplierId") ?? ""),
    description: String(formData.get("description") ?? "").trim(),
    status: String(formData.get("status") ?? "requested"),
    issueDate: String(formData.get("issueDate") ?? ""),
    expectedDeliveryDate: String(formData.get("expectedDeliveryDate") ?? ""),
    approverId: String(formData.get("approverId") ?? ""),
    notes: String(formData.get("notes") ?? "").trim(),
    linesJson: String(formData.get("linesJson") ?? "[]"),
  };

  const errors: PurchaseOrderEditFormState["errors"] = {};

  if (!values.id) errors._form = "Ordine non specificato.";
  if (!values.number) errors.number = "Obbligatorio.";
  if (!values.supplierId) errors.supplierId = "Seleziona un fornitore.";
  if (!isPoStatus(values.status)) errors.status = "Stato non valido.";
  if (
    values.issueDate &&
    values.expectedDeliveryDate &&
    values.expectedDeliveryDate < values.issueDate
  ) {
    errors.expectedDeliveryDate = "La consegna prevista non può precedere l'emissione.";
  }

  let lines: PurchaseOrderEditLineInput[] = [];
  try {
    lines = JSON.parse(values.linesJson);
    if (!Array.isArray(lines)) throw new Error("not an array");
  } catch {
    errors._form = "Righe dell'ordine non valide. Ricarica la pagina e riprova.";
  }

  const lineErrors: NonNullable<PurchaseOrderEditFormState["errors"]>["lines"] = {};
  if (!errors._form) {
    if (lines.length === 0) {
      errors._form = "Aggiungi almeno una riga (servizio + costo consulente).";
    }
    lines.forEach((line, i) => {
      const lineErr: Partial<Record<keyof PurchaseOrderLineInput, string>> = {};
      if (!line.serviceId) lineErr.serviceId = "Seleziona un servizio.";
      const cost = parseMoney(line.consultantCost);
      if (line.consultantCost === "" || Number.isNaN(cost) || cost < 0) {
        lineErr.consultantCost = "Importo valido richiesto (0 o superiore).";
      }
      const recharged = parseMoney(line.rechargedToClient || "0");
      if (Number.isNaN(recharged) || recharged < 0) lineErr.rechargedToClient = "Importo non valido.";
      const invoiced = parseMoney(line.invoicedAmount || "0");
      if (Number.isNaN(invoiced) || invoiced < 0) lineErr.invoicedAmount = "Importo non valido.";
      if (Object.keys(lineErr).length > 0) lineErrors[i] = lineErr;
    });
    if (Object.keys(lineErrors).length > 0) errors.lines = lineErrors;
  }

  if (Object.keys(errors).length > 0) {
    return { status: "error", errors, values };
  }

  try {
    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable("purchaseOrder")
        .set({
          number: values.number,
          supplierId: values.supplierId,
          description: values.description || null,
          status: values.status as PoStatus,
          issueDate: values.issueDate || null,
          expectedDeliveryDate: values.expectedDeliveryDate || null,
          approverId: values.approverId || null,
          notes: values.notes || null,
          updatedBy: session.personId,
        })
        .where("id", "=", values.id)
        .execute();

      const existing = await trx
        .selectFrom("purchaseOrderLine")
        .select(["id", "invoicedAmount"])
        .where("purchaseOrderId", "=", values.id)
        .execute();

      const submittedIds = new Set(lines.filter((l) => l.lineId).map((l) => l.lineId));
      const toDelete = existing.filter((row) => !submittedIds.has(row.id));
      const blockedDelete = toDelete.find((row) => Number(row.invoicedAmount) > 0);
      if (blockedDelete) {
        throw new Error("LINE_HAS_INVOICE");
      }
      if (toDelete.length > 0) {
        await trx
          .deleteFrom("purchaseOrderLine")
          .where(
            "id",
            "in",
            toDelete.map((r) => r.id)
          )
          .execute();
      }

      for (const line of lines) {
        const payload = {
          serviceId: line.serviceId,
          phaseRef: line.phaseRef || null,
          description: line.description || null,
          consultantCost: parseMoney(line.consultantCost).toFixed(2),
          rechargedToClient: parseMoney(line.rechargedToClient || "0").toFixed(2),
          invoicedAmount: parseMoney(line.invoicedAmount || "0").toFixed(2),
          updatedBy: session.personId,
        };
        if (line.lineId) {
          await trx.updateTable("purchaseOrderLine").set(payload).where("id", "=", line.lineId).execute();
        } else {
          await trx
            .insertInto("purchaseOrderLine")
            .values({ ...payload, purchaseOrderId: values.id, createdBy: session.personId })
            .execute();
        }
      }
    });

    return { status: "success", updatedSupplierId: values.supplierId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "LINE_HAS_INVOICE") {
      return {
        status: "error",
        errors: { _form: "Non puoi rimuovere una riga già fatturata dal fornitore — correggi gli importi invece di eliminarla." },
        values,
      };
    }
    if (message.includes("purchase_order_number_key")) {
      return { status: "error", errors: { number: "Questo numero ordine esiste già su un altro ordine." }, values };
    }
    return {
      status: "error",
      errors: { _form: "Errore imprevisto durante il salvataggio. Riprova." },
      values,
    };
  }
}
