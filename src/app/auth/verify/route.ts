import { createHash } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { encryptSession, SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS } from "@/lib/auth/session";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Scambia un token monouso del magic link per una sessione. Il token viene
// marcato usato PRIMA di reindirizzare, non dopo — così un secondo click
// sullo stesso link (es. lo scanner antivirus del client email che lo apre
// per controllarlo) non trova mai un token già consumato utilizzabile due volte.
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing_token", request.url));
  }

  const tokenHash = hashToken(token);
  const row = await db
    .selectFrom("magicLinkToken as t")
    .innerJoin("person as p", "p.id", "t.personId")
    .select([
      "t.id",
      "t.expiresAt",
      "t.usedAt",
      "p.id as personId",
      "p.email",
      "p.name",
      "p.role",
      "p.active",
    ])
    .where("t.tokenHash", "=", tokenHash)
    .executeTakeFirst();

  const isValid = row && !row.usedAt && row.expiresAt.getTime() >= Date.now() && row.active;
  if (!row || !isValid) {
    return NextResponse.redirect(new URL("/login?error=invalid_token", request.url));
  }

  await db.updateTable("magicLinkToken").set({ usedAt: new Date() }).where("id", "=", row.id).execute();

  const session = await encryptSession({
    personId: row.personId,
    email: row.email,
    name: row.name,
    role: row.role,
  });

  // Il cookie va impostato direttamente sulla risposta che restituiamo:
  // cookies() di next/headers non si sincronizza in modo affidabile con un
  // NextResponse.redirect() costruito a mano in una Route Handler (a
  // differenza di Server Component/Action, dove gestisce la risposta
  // implicita). Bug reale trovato testando il flusso via HTTP vero — senza
  // questo, il redirect a "/" avveniva ma senza portarsi dietro la sessione.
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set(SESSION_COOKIE_NAME, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION_SECONDS,
    path: "/",
  });

  return response;
}
