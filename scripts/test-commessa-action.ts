// Script di verifica manuale per createCommessa — non fa parte dell'app,
// serve a esercitare l'azione server con dati reali senza passare dal
// protocollo di invocazione delle Server Actions (che richiede un browser).
// Uso: npx tsx scripts/test-commessa-action.ts

import { createCommessa } from "../src/lib/actions/commessa";
import { db } from "../src/lib/db";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

async function main() {
  console.log("=== Caso 1: dati non validi (codice sbagliato, nessun cliente, importo mancante) ===");
  const r1 = await createCommessa(
    { status: "idle" },
    fd({ code: "26017", clientMode: "existing", clientId: "", contractValue: "", status: "active" })
  );
  console.log(JSON.stringify(r1, null, 2));
  if (r1.status !== "error" || !r1.errors?.code || !r1.errors?.clientId || !r1.errors?.contractValue) {
    throw new Error("Atteso: errori su code, clientId, contractValue");
  }
  console.log("OK — errori di validazione corretti\n");

  console.log("=== Caso 2: creazione valida con nuovo cliente ===");
  const r2 = await createCommessa(
    { status: "idle" },
    fd({
      code: "26-900",
      clientMode: "new",
      newClientName: "Cliente Script Test",
      newClientVat: "",
      assetName: "Via Test 1",
      clientContact: "Mario Rossi",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "active",
      contractValue: "12345.67",
    })
  );
  console.log(JSON.stringify(r2, null, 2));
  if (r2.status !== "success" || r2.createdCode !== "26-900") {
    throw new Error("Atteso: creazione riuscita con codice 26-900");
  }
  console.log("OK — commessa creata\n");

  console.log("=== Verifica in database ===");
  const row = await db
    .selectFrom("commessa as c")
    .innerJoin("client as cl", "cl.id", "c.clientId")
    .select(["c.code", "c.contractValue", "c.status", "c.assetName", "cl.name as clientName"])
    .where("c.code", "=", "26-900")
    .executeTakeFirstOrThrow();
  console.log(row);
  if (row.clientName !== "Cliente Script Test" || Number(row.contractValue) !== 12345.67) {
    throw new Error("I dati salvati non corrispondono a quelli inviati");
  }
  console.log("OK — i dati in database corrispondono a quelli inviati\n");

  console.log("=== Caso 3: stesso codice → deve fallire come duplicato ===");
  const r3 = await createCommessa(
    { status: "idle" },
    fd({
      code: "26-900",
      clientMode: "new",
      newClientName: "Un altro cliente",
      status: "active",
      contractValue: "100",
    })
  );
  console.log(JSON.stringify(r3, null, 2));
  if (r3.status !== "error" || !r3.errors?.code?.includes("esiste già")) {
    throw new Error("Atteso: errore di codice duplicato");
  }
  console.log("OK — duplicato rifiutato correttamente\n");

  console.log("=== Pulizia ===");
  await db.deleteFrom("commessa").where("code", "=", "26-900").execute();
  await db.deleteFrom("client").where("name", "=", "Cliente Script Test").execute();
  console.log("Pulizia completata.");

  await db.destroy();
}

main().catch(async (e) => {
  console.error("FALLITO:", e);
  await db.destroy();
  process.exit(1);
});
