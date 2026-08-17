// Verifica requestMagicLink: whitelist implicita (solo email note e attive
// ricevono un link), stesso messaggio per email sconosciuta/disattivata
// (§7 — non si conferma dall'esterno quali indirizzi sono validi).
// Uso: npx tsx scripts/test-magic-link-request.ts

import { requestMagicLink } from "../src/lib/actions/auth";
import { db } from "../src/lib/db";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

async function main() {
  console.log("=== Email valida e attiva ===");
  const r1 = await requestMagicLink({ status: "idle" }, fd({ email: "gdagradi@ilprisma.com" }));
  console.log(r1);
  if (r1.status !== "sent" || !r1.devLoginUrl) throw new Error("Atteso un link (AUTH_DEV_MODE)");
  const count1 = await db
    .selectFrom("magicLinkToken as t")
    .innerJoin("person as p", "p.id", "t.personId")
    .select((eb) => eb.fn.countAll().as("n"))
    .where("p.email", "=", "gdagradi@ilprisma.com")
    .executeTakeFirstOrThrow();
  console.log("Token creati per questa email:", count1.n);
  if (Number(count1.n) < 1) throw new Error("Atteso almeno un token creato");
  console.log("OK\n");

  console.log("=== Email sconosciuta: stesso messaggio, nessun token creato ===");
  const before = await db.selectFrom("magicLinkToken").select((eb) => eb.fn.countAll().as("n")).executeTakeFirstOrThrow();
  const r2 = await requestMagicLink({ status: "idle" }, fd({ email: "non-esiste@ilprisma.com" }));
  console.log(r2);
  const after = await db.selectFrom("magicLinkToken").select((eb) => eb.fn.countAll().as("n")).executeTakeFirstOrThrow();
  if (r2.status !== "sent" || r2.devLoginUrl) throw new Error("Attesa risposta 'sent' senza link per email sconosciuta");
  if (Number(after.n) !== Number(before.n)) throw new Error("Non doveva essere creato nessun token per un'email sconosciuta");
  console.log("OK — stesso messaggio, nessun token creato\n");

  console.log("=== Persona disattivata: stesso messaggio, nessun token ===");
  const anna = await db.selectFrom("person").select("id").where("email", "=", "avadacca@ilprisma.com").executeTakeFirstOrThrow();
  await db.updateTable("person").set({ active: false }).where("id", "=", anna.id).execute();
  const before2 = await db.selectFrom("magicLinkToken").select((eb) => eb.fn.countAll().as("n")).executeTakeFirstOrThrow();
  const r3 = await requestMagicLink({ status: "idle" }, fd({ email: "avadacca@ilprisma.com" }));
  console.log(r3);
  const after2 = await db.selectFrom("magicLinkToken").select((eb) => eb.fn.countAll().as("n")).executeTakeFirstOrThrow();
  if (r3.status !== "sent" || r3.devLoginUrl) throw new Error("Attesa risposta 'sent' senza link per persona disattivata");
  if (Number(after2.n) !== Number(before2.n)) throw new Error("Non doveva essere creato nessun token per una persona disattivata");
  await db.updateTable("person").set({ active: true }).where("id", "=", anna.id).execute();
  console.log("OK — stesso messaggio, nessun token, persona riattivata\n");

  console.log("=== Pulizia token di test ===");
  await db.deleteFrom("magicLinkToken").execute();
  console.log("Pulizia completata.");

  await db.destroy();
}

main().catch(async (e) => {
  console.error("FALLITO:", e);
  await db.destroy();
  process.exit(1);
});
