import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decryptSession, SESSION_COOKIE_NAME, type SessionPayload } from "@/lib/auth/session";
import { db } from "@/lib/db";

// Data Access Layer per l'autenticazione — un solo punto che legge e
// verifica la sessione, riusato da Server Components, Server Actions e
// Route Handler. cache() la memoizza per la durata di una singola
// richiesta: più chiamate a getSession() nello stesso render non
// ripetono la verifica del cookie né la query alla persona.

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

  // Il JWT prova solo "chi sei" (personId, firmato) — ruolo, stato attivo e
  // nome si rileggono sempre dal database, mai dal valore incapsulato nel
  // token al momento del login. Altrimenti revocare i permessi admin a
  // qualcuno non avrebbe effetto finché la sua sessione non scade (fino a
  // 12 ore) — importante ora che esiste una sezione Admin da proteggere.
  const person = await db
    .selectFrom("person")
    .select(["name", "email", "role", "active"])
    .where("id", "=", payload.personId)
    .executeTakeFirst();
  if (!person?.active) return null;

  return {
    personId: payload.personId,
    name: person.name,
    email: person.email,
    role: person.role,
  };
});

/** Per le Server Component / pagine: reindirizza a /login se non autenticato. */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Per le pagine Admin (§6.6, §7: "admin — full access, rate card, settings"). */
export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== "admin") {
    redirect("/?error=non_autorizzato");
  }
  return session;
}
