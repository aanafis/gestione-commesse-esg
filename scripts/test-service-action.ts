// Verifica manuale di createService, incluso il calcolo a cascata delle
// date delle fasi generate dal template (§4.1/§4.2).
// Uso: npx tsx scripts/test-service-action.ts

import { createService } from "../src/lib/actions/service";
import { db } from "../src/lib/db";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

async function main() {
  console.log("=== Preparazione: commessa di supporto ===");
  const client = await db.insertInto("client").values({ name: "Cliente Script Servizio" }).returning("id").executeTakeFirstOrThrow();
  const commessa = await db
    .insertInto("commessa")
    .values({ code: "26-901", clientId: client.id, status: "active", contractValue: "10000" })
    .returning(["id", "code"])
    .executeTakeFirstOrThrow();
  const serviceType = await db.selectFrom("serviceType").select("id").where("name", "=", "CRREM").executeTakeFirstOrThrow();
  console.log("OK\n");

  console.log("=== Caso 1: dati non validi ===");
  const r1 = await createService(
    { status: "idle" },
    fd({ commessaId: "", code: "bad", serviceTypeId: "", markup: "", contractedPrice: "", status: "active" })
  );
  console.log(JSON.stringify(r1, null, 2));
  if (r1.status !== "error" || !r1.errors?.commessaId || !r1.errors?.code || !r1.errors?.serviceTypeId || !r1.errors?.markup || !r1.errors?.contractedPrice) {
    throw new Error("Attesi errori su commessaId, code, serviceTypeId, markup, contractedPrice");
  }
  console.log("OK — errori di validazione corretti\n");

  console.log("=== Caso 2: codice che non inizia col codice della commessa ===");
  const r2 = await createService(
    { status: "idle" },
    fd({
      commessaId: commessa.id,
      code: "99-999-A",
      serviceTypeId: serviceType.id,
      status: "active",
      markup: "1.30",
      contractedPrice: "5000",
    })
  );
  console.log(JSON.stringify(r2, null, 2));
  if (r2.status !== "error" || !r2.errors?.code?.includes("codice della commessa")) {
    throw new Error("Atteso errore di coerenza codice/commessa");
  }
  console.log("OK\n");

  console.log("=== Caso 3: creazione valida con template CRREM e data di avvio ===");
  const r3 = await createService(
    { status: "idle" },
    fd({
      commessaId: commessa.id,
      code: "26-901-A",
      serviceTypeId: serviceType.id,
      templateName: "CRREM",
      startDate: "2026-01-01",
      status: "active",
      consultantCostBudget: "2000",
      markup: "1.30",
      contractedPrice: "10000",
    })
  );
  console.log(JSON.stringify(r3, null, 2));
  if (r3.status !== "success" || r3.generatedPhasesCount !== 6) {
    throw new Error("Attesa creazione riuscita con 6 fasi generate (template CRREM ha 6 fasi)");
  }
  console.log("OK — servizio creato con 6 fasi\n");

  console.log("=== Verifica cascata date fasi (a mano: 2026-01-01 + cumulativo durate) ===");
  const phases = await db
    .selectFrom("phase")
    .select(["sortOrder", "name", "plannedDate", "baselineDate", "baselineConfirmed", "hoursQuotaPct", "contractualMilestone"])
    .where("serviceId", "=", r3.createdId!)
    .orderBy("sortOrder")
    .execute();
  console.table(phases.map((p) => ({ ...p, plannedDate: p.plannedDate, baselineDate: p.baselineDate })));

  const expectedDates = ["2026-01-11", "2026-01-26", "2026-02-15", "2026-03-07", "2026-03-22", "2026-04-01"];
  for (let i = 0; i < phases.length; i++) {
    const got = new Date(phases[i].plannedDate as unknown as string).toISOString().slice(0, 10);
    if (got !== expectedDates[i]) {
      throw new Error(`Fase ${i + 1}: attesa ${expectedDates[i]}, ottenuta ${got}`);
    }
    if (!phases[i].baselineConfirmed) {
      throw new Error(`Fase ${i + 1}: baselineConfirmed atteso true`);
    }
  }
  const totalQuota = phases.reduce((s, p) => s + Number(p.hoursQuotaPct), 0);
  if (Math.abs(totalQuota - 1) > 0.0001) throw new Error(`hours_quota_pct non somma a 1: ${totalQuota}`);
  console.log("OK — tutte le date a cascata corrispondono al calcolo manuale, quote sommano a 1.0\n");

  console.log("=== Caso 4: stesso codice → duplicato ===");
  const r4 = await createService(
    { status: "idle" },
    fd({
      commessaId: commessa.id,
      code: "26-901-A",
      serviceTypeId: serviceType.id,
      status: "active",
      markup: "1.30",
      contractedPrice: "1000",
    })
  );
  console.log(JSON.stringify(r4, null, 2));
  if (r4.status !== "error" || !r4.errors?.code?.includes("esiste già")) {
    throw new Error("Atteso errore di codice duplicato");
  }
  console.log("OK\n");

  console.log("=== Pulizia ===");
  await db.deleteFrom("phase").where("serviceId", "=", r3.createdId!).execute();
  await db.deleteFrom("service").where("id", "=", r3.createdId!).execute();
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
