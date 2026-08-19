import { db } from "@/lib/db";

// Commesse — stessa impostazione di service-list.ts (§6.2 per analogia):
// tutti gli stati, il filtro lo fa l'utente in UI. v_commessa_metrics ha
// già reconciliation_ok, il controllo più importante a questo livello (§5).
export function getCommessaList() {
  return db
    .selectFrom("vCommessaMetrics as cm")
    .innerJoin("commessa as c", "c.id", "cm.commessaId")
    .innerJoin("client as cl", "cl.id", "c.clientId")
    .select([
      "cm.commessaId",
      "c.code",
      "cl.name as clientName",
      "c.assetName",
      "cm.status",
      "cm.servicesCount",
      "cm.contractValue",
      "cm.sumOfContractedPrices",
      "cm.reconciliationOk",
      "cm.marginToComplete",
      "cm.marginPct",
      "cm.collected",
      "cm.toBeInvoiced",
    ])
    .orderBy("c.code", "desc")
    .execute();
}

export type CommessaListRow = Awaited<ReturnType<typeof getCommessaList>>[number];
