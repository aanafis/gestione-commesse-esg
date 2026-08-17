"use server";

import { randomBytes, createHash } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

// Magic link (§7). Whitelist implicita: solo le email già presenti in
// Person (persone attive) ricevono un link — non esiste un modulo di
// registrazione, coerente con "4 users, all internal, whitelisted by email".

const TOKEN_TTL_MINUTES = 15;

export type MagicLinkFormState = {
  status: "idle" | "error" | "sent";
  error?: string;
  /** Solo in AUTH_DEV_MODE: nessun provider email collegato ancora
   *  (step 5 - deployment). Il link va mostrato a schermo invece che spedito. */
  devLoginUrl?: string;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
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
    .select(["id", "active"])
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

  const devLoginUrl = `/auth/verify?token=${token}`;

  if (process.env.AUTH_DEV_MODE === "true") {
    return { status: "sent", devLoginUrl };
  }

  // TODO(step 5 - deployment): collegare un vero invio email (Resend/SMTP)
  // e costruire un URL assoluto (qui serve il dominio pubblico dell'app).
  return { status: "sent" };
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE_NAME);
  redirect("/login");
}
