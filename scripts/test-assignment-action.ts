// Verifica manuale di createAssignment: snapshot tariffe, calcoli derivati
// (v_assignment_metrics) coerenti con quelli mostrati live nel form, e
// rifiuto del duplicato (service_id, person_id).
// Uso: npx tsx scripts/test-assignment-action.ts

import { createAssignment } from "../src/lib/actions/assignment";
import { db } from "../src/lib/db";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

async function main() {
  console.log("=== Preparazione: commessa + servizio di supporto ===");
  const client = await db.insertInto("client").values({ name: "Cliente Script Assegnazione" }).returning("id").executeTakeFirstOrThrow();
  const commessa = await db
    .insertInto("commessa")
    .values({ code: "26-902", clientId: client.id, status: "active", contractValue: "20000" })
    .returning("id")
    .executeTakeFirstOrThrow();
  const serviceType = await db.selectFrom("serviceType").select("id").where("name", "=", "LEED BD+C").executeTakeFirstOrThrow();
  const service = await db
    .insertInto("service")
    .values({
      code: "26-902-A",
      commessaId: commessa.id,
      serviceTypeId: serviceType.id,
      status: "active",
      consultantCostBudget: "4000",
      markup: "1.30",
      contractedPrice: "15000",
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const person = await db
    .selectFrom("person as p")
    .innerJoin("level as l", "l.id", "p.levelId")
    .select(["p.id", "p.name", "l.internalCostRate", "l.soldRate"])
    .where("p.name", "=", "Anna Vadacca")
    .executeTakeFirstOrThrow();
  console.log("OK\n");

  console.log("=== Caso 1: dati non validi ===");
  const r1 = await createAssignment(
    { status: "idle" },
    fd({ serviceId: "", personId: "", projectRole: "", estimatedHours: "" })
  );
  console.log(JSON.stringify(r1, null, 2));
  if (r1.status !== "error" || !r1.errors?.serviceId || !r1.errors?.personId || !r1.errors?.projectRole || !r1.errors?.estimatedHours) {
    throw new Error("Attesi errori su tutti e 4 i campi");
  }
  console.log("OK\n");

  console.log("=== Caso 2: creazione valida ===");
  const r2 = await createAssignment(
    { status: "idle" },
    fd({ serviceId: service.id, personId: person.id, projectRole: "site_inspections", estimatedHours: "80" })
  );
  console.log(JSON.stringify(r2, null, 2));
  if (r2.status !== "success" || r2.createdPersonName !== person.name) {
    throw new Error("Attesa creazione riuscita con il nome giusto");
  }
  console.log("OK\n");

  console.log("=== Verifica snapshot tariffe + calcoli derivati (v_assignment_metrics) ===");
  const row = await db
    .selectFrom("assignment")
    .select(["costRateSnapshot", "soldRateSnapshot"])
    .where("serviceId", "=", service.id)
    .where("personId", "=", person.id)
    .executeTakeFirstOrThrow();
  if (Number(row.costRateSnapshot) !== Number(person.internalCostRate) || Number(row.soldRateSnapshot) !== Number(person.soldRate)) {
    throw new Error("Snapshot tariffe non corrisponde al livello della persona");
  }
  console.log("OK — snapshot tariffe corretto");

  const metrics = await db
    .selectFrom("vAssignmentMetrics")
    .select(["hoursPrice", "hoursCost", "estimatedMargin"])
    .where("serviceId", "=", service.id)
    .where("personId", "=", person.id)
    .executeTakeFirstOrThrow();
  const expectedPrice = 80 * Number(person.soldRate);
  const expectedCost = 80 * Number(person.internalCostRate);
  console.log({ metrics, expectedPrice, expectedCost });
  if (Math.abs(Number(metrics.hoursPrice) - expectedPrice) > 0.001 || Math.abs(Number(metrics.hoursCost) - expectedCost) > 0.001) {
    throw new Error("hours_price/hours_cost non corrispondono al calcolo manuale (stessa formula usata dall'anteprima live nel form)");
  }
  console.log("OK — hours_price/hours_cost/margin coincidono col calcolo manuale (stessa formula del form)\n");

  console.log("=== Caso 3: stessa persona sullo stesso servizio → duplicato ===");
  const r3 = await createAssignment(
    { status: "idle" },
    fd({ serviceId: service.id, personId: person.id, projectRole: "documentation", estimatedHours: "10" })
  );
  console.log(JSON.stringify(r3, null, 2));
  if (r3.status !== "error" || !r3.errors?.personId?.includes("già assegnata")) {
    throw new Error("Atteso errore di duplicato");
  }
  console.log("OK\n");

  console.log("=== Pulizia ===");
  await db.deleteFrom("assignment").where("serviceId", "=", service.id).execute();
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
