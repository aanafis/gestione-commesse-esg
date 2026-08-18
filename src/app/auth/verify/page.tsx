import { createHash } from "crypto";
import Link from "next/link";
import { db } from "@/lib/db";
import { confirmMagicLink } from "@/lib/actions/auth";

// Prima era una Route Handler (GET) che scambiava il token per una sessione
// direttamente. Bug reale in produzione: gli scanner di sicurezza email
// aziendali (Safe Links e simili) precaricano il link per controllarlo,
// consumando il token monouso prima del click vero — l'utente trovava
// sempre "invalid_token". Questa pagina fa solo una lettura (innocua anche
// se prefetchata da uno scanner): il token si consuma solo quando l'utente
// clicca davvero il bottone "Accedi" (confirmMagicLink, una Server Action —
// vedi src/lib/actions/auth.ts).
export const dynamic = "force-dynamic";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export default async function VerifyPage(props: PageProps<"/auth/verify">) {
  const searchParams = await props.searchParams;
  const token = typeof searchParams.token === "string" ? searchParams.token : undefined;

  if (!token) {
    return <InvalidLink />;
  }

  const row = await db
    .selectFrom("magicLinkToken as t")
    .innerJoin("person as p", "p.id", "t.personId")
    .select(["t.expiresAt", "t.usedAt", "p.name", "p.active"])
    .where("t.tokenHash", "=", hashToken(token))
    .executeTakeFirst();

  const isValid = row && !row.usedAt && row.expiresAt.getTime() >= Date.now() && row.active;
  if (!row || !isValid) {
    return <InvalidLink />;
  }

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-sm flex-col justify-center gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-primary">Ciao, {row.name}</h1>
        <p className="text-sm text-ink-secondary">Clicca per completare l&apos;accesso.</p>
      </div>
      <form action={confirmMagicLink}>
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          Accedi
        </button>
      </form>
    </div>
  );
}

function InvalidLink() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-sm flex-col justify-center gap-4">
      <h1 className="text-2xl font-semibold text-ink-primary">Link non valido</h1>
      <p className="text-sm text-ink-secondary">
        Questo link non è più valido — è già stato usato o è scaduto (15 minuti).
      </p>
      <Link href="/login" className="text-sm text-accent hover:underline">
        Richiedi un nuovo link
      </Link>
    </div>
  );
}
