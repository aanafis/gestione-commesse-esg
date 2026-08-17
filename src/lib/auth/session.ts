import { SignJWT, jwtVerify } from "jose";

// Sessione stateless (§7: "session cookie thereafter"): un JWT firmato
// (HS256) nel cookie, verificato dal server senza bisogno di una tabella
// sessioni — solo il token monouso del magic link vive nel database
// (magic_link_token), per poterlo invalidare dopo un solo utilizzo.

export const SESSION_COOKIE_NAME = "session";
// "Session expiry after inactivity" (§7): il proxy rinnova questa scadenza
// ad ogni richiesta autenticata, quindi in pratica è inattività, non durata
// assoluta dal login.
export const SESSION_DURATION_SECONDS = 60 * 60 * 12; // 12 ore

export type SessionPayload = {
  personId: string;
  email: string;
  name: string;
  role: "admin" | "member";
};

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET non impostata (vedi .env.local).");
  }
  return new TextEncoder().encode(secret);
}

export async function encryptSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

export async function decryptSession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), { algorithms: ["HS256"] });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
