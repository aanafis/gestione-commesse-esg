// Verifica end-to-end del flusso di autenticazione via HTTP vero, contro un
// server già in esecuzione (npm run dev / npm run start).
//
// Usa fetch con redirect:"manual" e passa il cookie esplicitamente — un
// cookie jar implicito (visto con PowerShell/Invoke-WebRequest) si è
// dimostrato inaffidabile su questa catena redirect+cookie durante lo
// sviluppo di questa funzionalità.
//
// Uso:
//   $env:DATABASE_URL = "postgresql://..."
//   $env:BASE_URL = "http://localhost:3000"   # facoltativo, default sotto
//   node scripts/test-auth-http.js <email-persona-attiva>

const { Client } = require("pg");
const crypto = require("crypto");

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = process.argv[2] ?? "aanfi@ilprisma.com";

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function makeToken(client, email, minutesValid) {
  const person = await client.query("SELECT id, name FROM person WHERE email = $1", [email]);
  if (person.rows.length === 0) throw new Error(`Nessuna persona con email ${email}`);
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + minutesValid * 60 * 1000);
  await client.query("INSERT INTO magic_link_token (person_id, token_hash, expires_at) VALUES ($1, $2, $3)", [
    person.rows[0].id,
    hashToken(token),
    expiresAt,
  ]);
  return { token, personName: person.rows[0].name };
}

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  const { token, personName } = await makeToken(db, EMAIL, 15);
  console.log(`Token creato per ${personName}\n`);

  console.log("=== 1) GET /auth/verify?token=... ===");
  const r1 = await fetch(`${BASE_URL}/auth/verify?token=${token}`, { redirect: "manual" });
  const setCookie = r1.headers.get("set-cookie");
  console.log("status:", r1.status, "| set-cookie presente:", !!setCookie);
  if (!setCookie) throw new Error("Nessun cookie di sessione impostato");
  const cookiePair = setCookie.split(";")[0];

  console.log("\n=== 2) GET / con il cookie di sessione ===");
  const r2 = await fetch(`${BASE_URL}/`, { headers: { cookie: cookiePair }, redirect: "manual" });
  const body2 = await r2.text();
  const ok2 = r2.status === 200 && body2.includes(personName) && body2.includes("Esci");
  console.log("status:", r2.status, "| mostra nome ed Esci:", ok2);
  if (!ok2) throw new Error("La pagina autenticata non mostra correttamente nome/logout");

  console.log("\n=== 3) GET / SENZA cookie: deve reindirizzare a /login ===");
  const r3 = await fetch(`${BASE_URL}/`, { redirect: "manual" });
  console.log("status:", r3.status, "| location:", r3.headers.get("location"));
  if (r3.status < 300 || r3.status >= 400) throw new Error("Atteso un redirect senza sessione");

  console.log("\n=== 4) Riuso dello stesso token: deve fallire (monouso) ===");
  const r4 = await fetch(`${BASE_URL}/auth/verify?token=${token}`, { redirect: "manual" });
  const rejected = r4.headers.get("location")?.includes("invalid_token");
  console.log("status:", r4.status, "| rifiutato:", !!rejected);
  if (!rejected) throw new Error("Il token riusato avrebbe dovuto essere rifiutato");

  console.log("\nTUTTI I CONTROLLI PASSATI");
  await db.end();
}

main().catch((e) => {
  console.error("FALLITO:", e.message);
  process.exit(1);
});
