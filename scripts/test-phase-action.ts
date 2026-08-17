// Verifica manuale di updatePhaseProgress: la baseline non cambia mai dopo
// essere stata confermata (§4.2), anche se il form la manda comunque.
// Uso: npx tsx scripts/test-phase-action.ts

import { updatePhaseProgress } from "../src/lib/actions/phase";
import { db } from "../src/lib/db";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

async function main() {
  console.log("=== Preparazione: commessa/servizio/2 fasi (una con baseline confermata, una senza) ===");
  const client = await db.insertInto("client").values({ name: "Cliente Script Fase" }).returning("id").executeTakeFirstOrThrow();
  const commessa = await db
    .insertInto("commessa")
    .values({ code: "26-904", clientId: client.id, status: "active", contractValue: "5000" })
    .returning("id")
    .executeTakeFirstOrThrow();
  const serviceType = await db.selectFrom("serviceType").select("id").where("name", "=", "Fitwel").executeTakeFirstOrThrow();
  const service = await db
    .insertInto("service")
    .values({ code: "26-904-A", commessaId: commessa.id, serviceTypeId: serviceType.id, status: "active", markup: "1.3", contractedPrice: "5000" })
    .returning("id")
    .executeTakeFirstOrThrow();
  const phase1 = await db
    .insertInto("phase")
    .values({ serviceId: service.id, sortOrder: 1, name: "Fase A", baselineDate: "2026-01-01", baselineConfirmed: true, plannedDate: "2026-01-01", progressPct: "0" })
    .returning("id")
    .executeTakeFirstOrThrow();
  const phase2 = await db
    .insertInto("phase")
    .values({ serviceId: service.id, sortOrder: 2, name: "Fase B", baselineConfirmed: false, progressPct: "0" })
    .returning("id")
    .executeTakeFirstOrThrow();
  const owner = await db.selectFrom("person").select("id").where("name", "=", "Giovanni Della Valle").executeTakeFirstOrThrow();
  console.log("OK\n");

  console.log("=== Caso 1: avanzamento fuori range ===");
  const r1 = await updatePhaseProgress(
    { status: "idle" },
    fd({ phaseId: phase1.id, ownerId: "", plannedDate: "", actualDate: "", progressPct: "150", baselineDate: "" })
  );
  console.log(JSON.stringify(r1, null, 2));
  if (r1.status !== "error" || !r1.errors?.progressPct) throw new Error("Atteso errore su progressPct");
  console.log("OK\n");

  console.log("=== Caso 2: fase con baseline GIÀ confermata — tentativo di cambiarla comunque ===");
  const r2 = await updatePhaseProgress(
    { status: "idle" },
    fd({
      phaseId: phase1.id,
      ownerId: owner.id,
      plannedDate: "2026-02-01",
      actualDate: "",
      progressPct: "50",
      baselineDate: "2099-01-01", // tentativo — deve essere ignorato
    })
  );
  console.log(JSON.stringify(r2, null, 2));
  if (r2.status !== "success") throw new Error("Attesa riuscita");

  const p1After = await db.selectFrom("phase").selectAll().where("id", "=", phase1.id).executeTakeFirstOrThrow();
  console.log({
    baselineDate: p1After.baselineDate,
    plannedDate: p1After.plannedDate,
    progressPct: p1After.progressPct,
    ownerId: p1After.ownerId,
  });
  if (new Date(p1After.baselineDate as unknown as string).toISOString().slice(0, 10) !== "2026-01-01") {
    throw new Error("La baseline già confermata è stata modificata! Bug.");
  }
  if (Number(p1After.progressPct) !== 0.5 || p1After.ownerId !== owner.id) {
    throw new Error("progressPct/ownerId non aggiornati correttamente");
  }
  if (new Date(p1After.plannedDate as unknown as string).toISOString().slice(0, 10) !== "2026-02-01") {
    throw new Error("plannedDate non aggiornata (dovrebbe potersi spostare)");
  }
  console.log("OK — baseline confermata NON modificata, resto aggiornato correttamente\n");

  console.log("=== Caso 3: fase SENZA baseline — la imposta per la prima volta ===");
  const r3 = await updatePhaseProgress(
    { status: "idle" },
    fd({ phaseId: phase2.id, ownerId: "", plannedDate: "2026-03-15", actualDate: "", progressPct: "0", baselineDate: "2026-03-01" })
  );
  console.log(JSON.stringify(r3, null, 2));
  if (r3.status !== "success") throw new Error("Attesa riuscita");

  const p2After = await db.selectFrom("phase").select(["baselineDate", "baselineConfirmed"]).where("id", "=", phase2.id).executeTakeFirstOrThrow();
  console.log(p2After);
  if (!p2After.baselineConfirmed || new Date(p2After.baselineDate as unknown as string).toISOString().slice(0, 10) !== "2026-03-01") {
    throw new Error("Baseline non impostata correttamente alla prima conferma");
  }
  console.log("OK — baseline impostata e confermata alla prima volta\n");

  console.log("=== Caso 4: stessa fase, ora confermata — tentativo di ricambiare la baseline ===");
  const r4 = await updatePhaseProgress(
    { status: "idle" },
    fd({ phaseId: phase2.id, ownerId: "", plannedDate: "2026-03-15", actualDate: "", progressPct: "10", baselineDate: "2026-04-01" })
  );
  if (r4.status !== "success") throw new Error("Attesa riuscita");
  const p2After2 = await db.selectFrom("phase").select(["baselineDate"]).where("id", "=", phase2.id).executeTakeFirstOrThrow();
  if (new Date(p2After2.baselineDate as unknown as string).toISOString().slice(0, 10) !== "2026-03-01") {
    throw new Error("La baseline è stata ri-modificata dopo la conferma! Bug.");
  }
  console.log("OK — baseline resta 2026-03-01 anche al secondo tentativo\n");

  console.log("=== Pulizia ===");
  await db.deleteFrom("phase").where("serviceId", "=", service.id).execute();
  await db.deleteFrom("service").where("id", "=", service.id).execute();
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
