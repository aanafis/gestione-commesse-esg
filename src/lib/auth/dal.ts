import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decryptSession, SESSION_COOKIE_NAME, type SessionPayload } from "@/lib/auth/session";
import { db } from "@/lib/db";

// Data Access Layer per l'autenticazione — un solo punto che legge e
// verifica la sessione, riusato da Server Components, Server Actions e
// Route Handler. cache() la memoizza per la durata di una singola
// richiesta: più chiamate a getSession() nello stesso render non
// ripetono la verifica del cookie né la query "la persona è ancora attiva".

export const getSession = cache(async (): Promise<SessionPayload | null> => {
  let token: string | undefined;
  try {
    token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  } catch {
    // cookies() richiede un contesto di richiesta reale (Server Component,
    // Server Action, Route Handler). Chiamata fuori da lì — es. dagli
    // script di verifica in scripts/ — equivale a "nessuna sessione".
    return null;
  }
  const payload = await decryptSession(token);
  if (!payload) return null;

  // Controllo "secure", non solo ottimistico (§7): se la persona è stata
  // disattivata dopo l'emissione della sessione, l'accesso si chiude subito
  // invece di aspettare la scadenza del cookie.
  const person = await db
    .selectFrom("person")
    .select(["active"])
    .where("id", "=", payload.personId)
    .executeTakeFirst();
  if (!person?.active) return null;

  return payload;
});

/** Per le Server Component / pagine: reindirizza a /login se non autenticato. */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
