import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  decryptSession,
  encryptSession,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
} from "@/lib/auth/session";

// Proxy (in Next.js 16 sostituisce "Middleware", stessa funzione — vedi
// node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md).
//
// Controllo "ottimistico" (§7): legge solo il cookie, nessuna query al
// database qui — il controllo "sicuro" (persona ancora attiva?) vive nel
// DAL (src/lib/auth/dal.ts), usato da Server Component e Server Action.

const PUBLIC_PATHS = ["/login", "/auth/verify"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await decryptSession(token);

  if (!isPublic && !session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname === "/login" && session) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const response = NextResponse.next();

  if (session) {
    // Scadenza per inattività (§7): rinnovata ad ogni richiesta autenticata,
    // non una durata fissa dal login.
    const refreshed = await encryptSession(session);
    response.cookies.set(SESSION_COOKIE_NAME, refreshed, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_DURATION_SECONDS,
      path: "/",
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
