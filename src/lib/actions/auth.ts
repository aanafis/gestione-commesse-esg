"use server";

import { randomBytes, createHash } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { sendMagicLinkEmail } from "@/lib/email";

// Magic link (§7). Whitelist implicita: solo le email già presenti in
// Person (persone attive) ricevono un link — non esiste un modulo di
// registrazione, coerente con "4 users, all internal, whitelisted by email".

const TOKEN_TTL_MINUTES = 15;

export type MagicLinkFormState = {
  status: "idle" | "error" | "sent";
  error?: string;
  /** Solo in AUTH_DEV_MODE: nessun'email viene davvero inviata, il link
   *  compare a schermo — utile in sviluppo locale. */
  devLoginUrl?: string;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * URL assoluto dell'app, in ordine di preferenza:
 * 1. APP_URL — esplicito, per un dominio personalizzato
 * 2. VERCEL_PROJECT_PRODUCTION_URL — il dominio di produzione stabile che
 *    Vercel imposta da solo (non cambia ad ogni deploy, a differenza di
 *    VERCEL_URL)
 * 3. VERCEL_URL — fallback per i deploy di anteprima
 * 4. localhost — sviluppo locale
 */
function getAppUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function requestMagicLink(
  _prevState: MagicLinkFormState,
  formData: FormData
): Promise<MagicLinkFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    return { status: "error", error: "Inserisci il tuo indirizzo email." };
  }

  const person = await db
    .selectFrom("person")
    .select(["id", "name", "active"])
    .where("email", "=", email)
    .executeTakeFirst();

  // Stessa risposta sia per email inesistente sia per persona disattivata:
  // non si conferma dall'esterno quali indirizzi sono validi.
  if (!person || !person.active) {
    return { status: "sent" };
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

  await db
    .insertInto("magicLinkToken")
    .values({ personId: person.id, tokenHash: hashToken(token), expiresAt })
    .execute();

  const loginPath = `/auth/verify?token=${token}`;

  if (process.env.AUTH_DEV_MODE === "true") {
    return { status: "sent", devLoginUrl: loginPath };
  }

  try {
    await sendMagicLinkEmail({ to: email, name: person.name, url: `${getAppUrl()}${loginPath}` });
  } catch (err) {
    console.error("Invio magic link fallito:", err);
    return {
      status: "error",
      error: "Non sono riuscito a inviare l'email. Riprova tra poco o avvisa l'amministratore.",
    };
  }

  return { status: "sent" };
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE_NAME);
  redirect("/login");
}
