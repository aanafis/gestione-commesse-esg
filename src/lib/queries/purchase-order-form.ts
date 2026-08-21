import { db } from "@/lib/db";

export function getSuppliersForSelect() {
  return db
    .selectFrom("supplier")
    .select(["id", "code", "name"])
    .orderBy("name")
    .execute();
}

export function getServicesForPurchaseOrderForm() {
  return db
    .selectFrom("service as s")
    .innerJoin("commessa as c", "c.id", "s.commessaId")
    .select(["s.id", "s.code", "c.code as commessaCode"])
    .where("s.status", "!=", "closed")
    .orderBy("s.code")
    .execute();
}

export function getApproversForSelect() {
  return db
    .selectFrom("person")
    .select(["id", "name"])
    .where("active", "=", true)
    .orderBy("name")
    .execute();
}

export async function getApprovalThresholds(): Promise<{ pm: string; director: string }> {
  const s = await db
    .selectFrom("settings")
    .select(["pmApprovalThreshold", "directorApprovalThreshold"])
    .executeTakeFirst();
  return { pm: s?.pmApprovalThreshold ?? "5000", director: s?.directorApprovalThreshold ?? "15000" };
}

/** Ordine + le sue righe, per la maschera di modifica — un ordine può
 * coprire più servizi (§4.2): aggiungere un servizio a un ordine già
 * emesso è aggiungere una riga qui, non crearne uno nuovo con lo stesso
 * numero (che il vincolo UNIQUE su number rifiuta di proposito). */
export async function getPurchaseOrderForEdit(id: string) {
  const header = await db
    .selectFrom("purchaseOrder")
    .select([
      "id",
      "number",
      "supplierId",
      "description",
      "status",
      "issueDate",
      "expectedDeliveryDate",
      "approverId",
      "notes",
    ])
    .where("id", "=", id)
    .executeTakeFirst();
  if (!header) return null;

  const lines = await db
    .selectFrom("purchaseOrderLine")
    .select(["id", "serviceId", "phaseRef", "description", "consultantCost", "rechargedToClient", "invoicedAmount"])
    .where("purchaseOrderId", "=", id)
    .orderBy("id")
    .execute();

  return { ...header, lines };
}
