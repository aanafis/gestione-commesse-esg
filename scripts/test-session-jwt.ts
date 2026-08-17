// Verifica encryptSession/decryptSession: round-trip corretto, token
// manomesso rifiutato, token scaduto rifiutato.
// Uso: npx tsx scripts/test-session-jwt.ts

import { encryptSession, decryptSession } from "../src/lib/auth/session";
import { SignJWT } from "jose";

async function main() {
  const payload = { personId: "1", email: "a@ilprisma.com", name: "Test", role: "member" as const };

  console.log("=== Round-trip corretto ===");
  const token = await encryptSession(payload);
  const decoded = await decryptSession(token);
  console.log(decoded);
  if (decoded?.personId !== "1" || decoded.role !== "member") throw new Error("Round-trip non corretto");
  console.log("OK\n");

  console.log("=== Token manomesso (ultimo carattere alterato) ===");
  const tampered = token.slice(0, -1) + (token.slice(-1) === "a" ? "b" : "a");
  const decodedTampered = await decryptSession(tampered);
  console.log(decodedTampered);
  if (decodedTampered !== null) throw new Error("Un token manomesso non deve mai essere accettato");
  console.log("OK — rifiutato\n");

  console.log("=== Token scaduto ===");
  const secret = new TextEncoder().encode(process.env.AUTH_SECRET!);
  const expired = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 1800)
    .sign(secret);
  const decodedExpired = await decryptSession(expired);
  console.log(decodedExpired);
  if (decodedExpired !== null) throw new Error("Un token scaduto non deve mai essere accettato");
  console.log("OK — rifiutato\n");

  console.log("=== Nessun token ===");
  const decodedNone = await decryptSession(undefined);
  if (decodedNone !== null) throw new Error("undefined deve dare null");
  console.log("OK\n");

  console.log("TUTTI I CONTROLLI PASSATI");
}

main().catch((e) => {
  console.error("FALLITO:", e);
  process.exit(1);
});
