// Verifica end-to-end del flusso di autenticazione via HTTP vero, contro un
// server già in esecuzione (npm run dev / npm run start).
//
// Usa fetch con redirect:"manual" e passa il cookie esplicitamente — un
// cookie jar implicito (visto con PowerShell/Invoke-WebRequest) si è
// dimostrato inaffidabile su questa catena redirect+cookie durante lo
// sviluppo di questa funzionalità.
//
// Flusso in due passi (§7): la GET su /auth/verify mostra solo una pagina di
// conferma (sola lettura, sicura anche se un antivirus/Safe Links aziendale
// la precarica); solo il POST della Server Action confirmMagicLink — che
// simuliamo qui costruendo a mano il multipart/form-data che il bottone
// "Accedi" invierebbe — consuma davvero il token e crea la sessione. Prima
// era una GET a fare tutto: bug reale trovato in produzione, uno scanner
// aziendale consumava il token prima del click umano.
//
// Uso:
//   $env:DATABASE_URL = "postgresql://..."
//   $env:BASE_URL = "http://localhost:3000"   # facoltativo, default sotto
//   node scripts/test-auth-http.js <email-persona-attiva>

const { Client } = require("pg");
const crypto = require("crypto");

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = process.argv[2] ?? "aanafi@ilprisma.com";

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function makeToken(client, email, minutesValid) {
  const person = await client.query("SELECT id, name FROM person WHERE email = $1", [email]);
  if (person.rows.length === 0) throw new Error(`Nessuna persona con email ${email}`);
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + minutesValid * 60 * 1000);
  const inserted = await client.query(
    "INSERT INTO magic_link_token (person_id, token_hash, expires_at) VALUES ($1, $2, $3) RETURNING id",
    [person.rows[0].id, hashToken(token), expiresAt]
  );
  return { token, tokenId: inserted.rows[0].id, personName: person.rows[0].name };
}

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  const { token, tokenId, personName } = await makeToken(db, EMAIL, 15);
  console.log(`Token creato per ${personName}\n`);

  console.log("=== 1) GET /auth/verify?token=... — deve mostrare la conferma, non loggare ===");
  const r1 = await fetch(`${BASE_URL}/auth/verify?token=${token}`);
  const body1 = await r1.text();
  console.log("status:", r1.status, "| mostra bottone Accedi:", body1.includes(">Accedi<"));
  const actionMatch = body1.match(/name="(\$ACTION_ID_[a-f0-9]+)"/);
  if (!actionMatch) throw new Error("Non trovo il bottone di conferma nella pagina");
  const usedAfterGet = await db.query("SELECT used_at FROM magic_link_token WHERE id = $1", [tokenId]);
  if (usedAfterGet.rows[0].used_at !== null) throw new Error("BUG: la GET ha consumato il token");
  console.log("token ancora valido dopo la GET: sì (come deve essere)");

  console.log("\n=== 2) POST — il click reale sul bottone \"Accedi\" ===");
  const form = new FormData();
  form.set(actionMatch[1], "");
  form.set("token", token);
  const r2 = await fetch(`${BASE_URL}/auth/verify?token=${token}`, { method: "POST", body: form, redirect: "manual" });
  const setCookie = r2.headers.get("set-cookie");
  console.log("status:", r2.status, "| set-cookie presente:", !!setCookie);
  if (!setCookie) throw new Error("Nessun cookie di sessione impostato");
  const cookiePair = setCookie.split(";")[0];

  console.log("\n=== 3) GET / con il cookie di sessione ===");
  const r3 = await fetch(`${BASE_URL}/`, { headers: { cookie: cookiePair }, redirect: "manual" });
  const body3 = await r3.text();
  const ok3 = r3.status === 200 && body3.includes(personName) && body3.includes("Esci");
  console.log("status:", r3.status, "| mostra nome ed Esci:", ok3);
  if (!ok3) throw new Error("La pagina autenticata non mostra correttamente nome/logout");

  console.log("\n=== 4) GET / SENZA cookie: deve reindirizzare a /login ===");
  const r4 = await fetch(`${BASE_URL}/`, { redirect: "manual" });
  console.log("status:", r4.status, "| location:", r4.headers.get("location"));
  if (r4.status < 300 || r4.status >= 400) throw new Error("Atteso un redirect senza sessione");

  console.log("\n=== 5) Riuso dello stesso token (POST di nuovo): deve fallire (monouso) ===");
  const form2 = new FormData();
  form2.set(actionMatch[1], "");
  form2.set("token", token);
  const r5 = await fetch(`${BASE_URL}/auth/verify?token=${token}`, { method: "POST", body: form2, redirect: "manual" });
  const rejected = r5.headers.get("location")?.includes("invalid_token");
  console.log("status:", r5.status, "| rifiutato:", !!rejected);
  if (!rejected) throw new Error("Il token riusato avrebbe dovuto essere rifiutato");

  console.log("\nTUTTI I CONTROLLI PASSATI");
  await db.end();
}

main().catch((e) => {
  console.error("FALLITO:", e.message);
  process.exit(1);
});
