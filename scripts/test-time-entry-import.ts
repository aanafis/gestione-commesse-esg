// Verifica manuale dell'import CSV: mappatura colonne, validazione riga per
// riga, upsert su re-import (mai duplicati), righe manuali mai toccate.
// Uso: npx tsx scripts/test-time-entry-import.ts

import { parseTimeEntryCsv, importTimeEntries } from "../src/lib/actions/time-entry-import";
import { db } from "../src/lib/db";

function fileFrom(text: string): File {
  return new File([text], "ore.csv", { type: "text/csv" });
}

function fd(entries: Record<string, string | File>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v as string);
  return f;
}

async function main() {
  console.log("=== Preparazione: commessa/servizio/fase/persone ===");
  const client = await db.insertInto("client").values({ name: "Cliente Script Import" }).returning("id").executeTakeFirstOrThrow();
  const commessa = await db
    .insertInto("commessa")
    .values({ code: "26-906", clientId: client.id, status: "active", contractValue: "5000" })
    .returning("id")
    .executeTakeFirstOrThrow();
  const serviceType = await db.selectFrom("serviceType").select("id").where("name", "=", "Access4You").executeTakeFirstOrThrow();
  const service = await db
    .insertInto("service")
    .values({ code: "26-906-A", commessaId: commessa.id, serviceTypeId: serviceType.id, status: "active", markup: "1.3", contractedPrice: "5000" })
    .returning("id")
    .executeTakeFirstOrThrow();
  await db.insertInto("phase").values({ serviceId: service.id, sortOrder: 1, name: "Fase Test", progressPct: "0" }).execute();
  const giulia = await db.selectFrom("person").select("id").where("email", "=", "gdagradi@ilprisma.com").executeTakeFirstOrThrow();
  const anna = await db.selectFrom("person").select("id").where("email", "=", "avadacca@ilprisma.com").executeTakeFirstOrThrow();
  console.log("OK\n");

  console.log("=== Passo 1: upload e lettura intestazioni ===");
  const csv1 = [
    "Mese;Servizio;Persona;Ore;Fase",
    "2026-07;26-906-A;gdagradi@ilprisma.com;7,5;Fase Test",
    "2026-07;26-906-A;avadacca@ilprisma.com;5;Fase Sconosciuta",
    "2026-07;99-999-Z;gdagradi@ilprisma.com;3;",
    "2026-07;26-906-A;persona.inesistente@x.com;2;",
    "2026-07;26-906-A;gdagradi@ilprisma.com;abc;",
  ].join("\n");
  const uploadResult = await parseTimeEntryCsv({ step: "idle" }, fd({ file: fileFrom(csv1) }));
  console.log({ step: uploadResult.step, headers: uploadResult.headers, totalDataRows: uploadResult.totalDataRows });
  if (uploadResult.step !== "mapped" || uploadResult.totalDataRows !== 5) {
    throw new Error("Attese 5 righe dati lette, delimitatore ';' auto-rilevato");
  }
  console.log("OK — delimitatore ';' rilevato correttamente, 5 righe lette\n");

  const mapping = {
    csvText: uploadResult.csvText!,
    monthMode: "column",
    monthColumn: "0",
    serviceColumn: "1",
    personColumn: "2",
    hoursColumn: "3",
    phaseColumn: "4",
  };

  console.log("=== Passo 2: anteprima (mode=preview) ===");
  const preview = await importTimeEntries({ step: "idle" }, fd({ ...mapping, mode: "preview" }));
  console.log(JSON.stringify(preview, null, 2));
  if (preview.step !== "preview" || preview.totalRows !== 5 || preview.validCount !== 2) {
    throw new Error(`Attese 5 righe totali, 2 valide. Ottenuto: ${preview.totalRows}/${preview.validCount}`);
  }
  if (preview.errors?.length !== 3) throw new Error("Attesi 3 errori (servizio, persona, ore non validi)");
  if (preview.warnings?.length !== 1) throw new Error("Atteso 1 avviso (fase non trovata)");
  console.log("OK — 2 valide, 3 errori, 1 avviso, come atteso\n");

  console.log("=== Passo 3: conferma import (mode=commit) ===");
  const commit1 = await importTimeEntries({ step: "idle" }, fd({ ...mapping, mode: "commit" }));
  console.log(JSON.stringify(commit1, null, 2));
  if (commit1.step !== "done" || commit1.insertedCount !== 2 || commit1.updatedCount !== 0) {
    throw new Error("Attese 2 righe inserite, 0 aggiornate al primo import");
  }
  console.log("OK\n");

  const rowsAfter1 = await db
    .selectFrom("timeEntry")
    .select(["personId", "hours", "phaseId", "source"])
    .where("serviceId", "=", service.id)
    .execute();
  console.log("Righe in database dopo il primo import:", rowsAfter1);
  const giuliaRow = rowsAfter1.find((r) => r.personId === giulia.id);
  const annaRow = rowsAfter1.find((r) => r.personId === anna.id);
  if (Number(giuliaRow?.hours) !== 7.5 || !giuliaRow?.phaseId) throw new Error("Riga Giulia non corretta (ore o fase)");
  if (Number(annaRow?.hours) !== 5 || annaRow?.phaseId !== null) throw new Error("Riga Anna non corretta (deve avere phaseId NULL)");
  console.log("OK — fase collegata quando trovata, NULL quando no (con avviso, non errore)\n");

  console.log("=== Passo 4: riga manuale sulla stessa tripla mese/servizio/persona ===");
  await db
    .insertInto("timeEntry")
    .values({ month: "2026-07", serviceId: service.id, personId: giulia.id, hours: "100", source: "manual", costRateSnapshot: "38" })
    .execute();
  console.log("Inserita riga manuale con 100 ore (deve restare intoccata dal prossimo re-import)\n");

  console.log("=== Passo 5: re-import con ore corrette per Giulia (7,5 → 9,0) ===");
  const csv2 = csv1.replace("7,5", "9,0");
  const upload2 = await parseTimeEntryCsv({ step: "idle" }, fd({ file: fileFrom(csv2) }));
  const mapping2 = { ...mapping, csvText: upload2.csvText! };
  const commit2 = await importTimeEntries({ step: "idle" }, fd({ ...mapping2, mode: "commit" }));
  console.log(JSON.stringify(commit2, null, 2));
  if (commit2.insertedCount !== 0 || commit2.updatedCount !== 2) {
    throw new Error("Attese 0 inserite, 2 aggiornate al secondo import (stessa tripla di prima)");
  }

  const rowsAfter2 = await db
    .selectFrom("timeEntry")
    .select(["personId", "hours", "source"])
    .where("serviceId", "=", service.id)
    .execute();
  console.log("Righe in database dopo il secondo import:", rowsAfter2);
  const giuliaImportRow = rowsAfter2.find((r) => r.personId === giulia.id && r.source === "import");
  const giuliaManualRow = rowsAfter2.find((r) => r.personId === giulia.id && r.source === "manual");
  if (Number(giuliaImportRow?.hours) !== 9) throw new Error("La riga import di Giulia doveva aggiornarsi a 9 ore");
  if (Number(giuliaManualRow?.hours) !== 100) throw new Error("BUG: la riga manuale è stata alterata dal re-import!");
  if (rowsAfter2.filter((r) => r.personId === giulia.id).length !== 2) {
    throw new Error("Attese esattamente 2 righe per Giulia (import + manuale), niente duplicati");
  }
  console.log("OK — re-import aggiorna solo la riga 'import', la riga 'manual' resta intoccata, nessun duplicato\n");

  console.log("=== Pulizia ===");
  await db.deleteFrom("timeEntry").where("serviceId", "=", service.id).execute();
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
