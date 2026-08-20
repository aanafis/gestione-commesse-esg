import { db } from "@/lib/db";

// Scheda fornitore (richiesta dall'utente): quante commesse/servizi ha un
// fornitore/consulente esterno, con quali ODA e a che punto di pagamento —
// oggi visibile solo spezzettato per servizio (tab ODA della Scheda
// servizio), mai raggruppato per fornitore.

export function getSupplierHeader(id: string) {
  return db.selectFrom("supplier").selectAll().where("id", "=", id).executeTakeFirst();
}

export function getSupplierPurchaseOrderLines(id: string) {
  return db
    .selectFrom("vPurchaseOrderLineMetrics as l")
    .innerJoin("purchaseOrder as po", "po.id", "l.purchaseOrderId")
    .innerJoin("service as s", "s.id", "l.serviceId")
    .innerJoin("commessa as c", "c.id", "s.commessaId")
    .select([
      "l.lineId",
      "po.id as purchaseOrderId",
      "po.number",
      "po.status as poStatus",
      "po.issueDate",
      "po.pdfFilename",
      "po.pdfUploadedAt",
      "s.id as serviceId",
      "s.code as serviceCode",
      "c.code as commessaCode",
      "l.phaseRef",
      "l.consultantCost",
      "l.rechargedToClient",
      "l.invoicedAmount",
      "l.lineMargin",
      "l.isCommitted",
    ])
    .where("po.supplierId", "=", id)
    .orderBy("po.number")
    .execute();
}

export type SupplierPurchaseOrderLine = Awaited<ReturnType<typeof getSupplierPurchaseOrderLines>>[number];
