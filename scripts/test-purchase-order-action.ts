// Verifica manuale di createPurchaseOrder: più righe su più servizi,
// livello di approvazione dalle soglie, costo impegnato per servizio.
// Uso: npx tsx scripts/test-purchase-order-action.ts

import { createPurchaseOrder } from "../src/lib/actions/purchase-order";
import { db } from "../src/lib/db";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

async function main() {
  console.log("=== Preparazione: commessa con due servizi + fornitore ===");
  const client = await db.insertInto("client").values({ name: "Cliente Script ODA" }).returning("id").executeTakeFirstOrThrow();
  const commessa = await db
    .insertInto("commessa")
    .values({ code: "26-903", clientId: client.id, status: "active", contractValue: "30000" })
    .returning("id")
    .executeTakeFirstOrThrow();
  const serviceType = await db.selectFrom("serviceType").select("id").where("name", "=", "WELL v.2").executeTakeFirstOrThrow();
  const serviceA = await db
    .insertInto("service")
    .values({ code: "26-903-A", commessaId: commessa.id, serviceTypeId: serviceType.id, status: "active", consultantCostBudget: "3000", markup: "1.3", contractedPrice: "15000" })
    .returning("id")
    .executeTakeFirstOrThrow();
  const serviceB = await db
    .insertInto("service")
    .values({ code: "26-903-B", commessaId: commessa.id, serviceTypeId: serviceType.id, status: "active", consultantCostBudget: "3000", markup: "1.3", contractedPrice: "15000" })
    .returning("id")
    .executeTakeFirstOrThrow();
  const supplier = await db.selectFrom("supplier").select("id").where("code", "=", "FOR-001").executeTakeFirstOrThrow();
  const thresholds = await db.selectFrom("settings").select(["pmApprovalThreshold", "directorApprovalThreshold"]).executeTakeFirstOrThrow();
  console.log("Soglie:", thresholds);
  console.log("OK\n");

  console.log("=== Caso 1: dati non validi (nessuna riga, campi mancanti) ===");
  const r1 = await createPurchaseOrder(
    { status: "idle" },
    fd({ number: "", supplierId: "", status: "requested", linesJson: "[]" })
  );
  console.log(JSON.stringify(r1, null, 2));
  if (r1.status !== "error" || !r1.errors?.number || !r1.errors?.supplierId || !r1.errors?._form) {
    throw new Error("Attesi errori su number, supplierId, e _form (nessuna riga)");
  }
  console.log("OK\n");

  console.log("=== Caso 2: riga con dati non validi ===");
  const r2 = await createPurchaseOrder(
    { status: "idle" },
    fd({
      number: "TEST-ODA-BAD",
      supplierId: supplier.id,
      status: "requested",
      linesJson: JSON.stringify([{ serviceId: "", phaseRef: "", consultantCost: "", rechargedToClient: "0", invoicedAmount: "0" }]),
    })
  );
  console.log(JSON.stringify(r2, null, 2));
  if (r2.status !== "error" || !r2.errors?.lines?.[0]?.serviceId || !r2.errors?.lines?.[0]?.consultantCost) {
    throw new Error("Attesi errori sulla riga 0 (serviceId, consultantCost)");
  }
  console.log("OK\n");

  console.log("=== Caso 3: ordine valido, 2 righe su 2 servizi diversi, totale sopra soglia PM ===");
  // Soglia PM di default 5000: 4000 + 2500 = 6500 > 5000 → approvalLevel 'project_manager' (atteso, se sotto i 15000 di direttore)
  const r3 = await createPurchaseOrder(
    { status: "idle" },
    fd({
      number: "TEST-ODA-1",
      supplierId: supplier.id,
      status: "issued",
      linesJson: JSON.stringify([
        { serviceId: serviceA.id, phaseRef: "Fase Design", consultantCost: "4000", rechargedToClient: "5200", invoicedAmount: "0" },
        { serviceId: serviceB.id, phaseRef: "", consultantCost: "2500", rechargedToClient: "3250", invoicedAmount: "0" },
      ]),
    })
  );
  console.log(JSON.stringify(r3, null, 2));
  if (r3.status !== "success") throw new Error("Attesa creazione riuscita");
  const expectedLevel = 6500 <= Number(thresholds.pmApprovalThreshold)
    ? "autonomous"
    : 6500 <= Number(thresholds.directorApprovalThreshold)
      ? "project_manager"
      : "director";
  if (r3.approvalLevel !== expectedLevel) {
    throw new Error(`Livello approvazione atteso ${expectedLevel}, ottenuto ${r3.approvalLevel}`);
  }
  console.log(`OK — 2 righe create su 2 servizi, livello approvazione corretto (${expectedLevel})\n`);

  console.log("=== Verifica costo impegnato per servizio (v_service_metrics, status 'issued' => committed) ===");
  const metricsA = await db.selectFrom("vServiceMetrics").select("committedConsultantCost").where("serviceId", "=", serviceA.id).executeTakeFirstOrThrow();
  const metricsB = await db.selectFrom("vServiceMetrics").select("committedConsultantCost").where("serviceId", "=", serviceB.id).executeTakeFirstOrThrow();
  console.log({ metricsA, metricsB });
  if (Number(metricsA.committedConsultantCost) !== 4000 || Number(metricsB.committedConsultantCost) !== 2500) {
    throw new Error("committed_consultant_cost non corrisponde alle righe inserite");
  }
  console.log("OK — costo impegnato corretto su entrambi i servizi\n");

  console.log("=== Caso 4: stesso numero ordine → duplicato ===");
  const r4 = await createPurchaseOrder(
    { status: "idle" },
    fd({
      number: "TEST-ODA-1",
      supplierId: supplier.id,
      status: "requested",
      linesJson: JSON.stringify([{ serviceId: serviceA.id, phaseRef: "", consultantCost: "100", rechargedToClient: "0", invoicedAmount: "0" }]),
    })
  );
  console.log(JSON.stringify(r4, null, 2));
  if (r4.status !== "error" || !r4.errors?.number?.includes("esiste già")) {
    throw new Error("Atteso errore di numero ordine duplicato");
  }
  console.log("OK\n");

  console.log("=== Pulizia ===");
  await db.deleteFrom("purchaseOrderLine").where("purchaseOrderId", "=", r3.createdId!).execute();
  await db.deleteFrom("purchaseOrder").where("id", "=", r3.createdId!).execute();
  await db.deleteFrom("service").where("id", "in", [serviceA.id, serviceB.id]).execute();
  await db.deleteFrom("commessa").where("id", "=", commessa.id).execute();
  await db.deleteFrom("client").where("id", "=", client.id).execute();
  console.log("Pulizia completata.");

  await db.destroy();
}

main().catch(async (e) => {
  console.error("FALLITO:", e);
  await db.destroy();
  process.exit(1);
});
