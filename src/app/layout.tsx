import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getSession } from "@/lib/auth/dal";
import { logout } from "@/lib/actions/auth";

export const metadata: Metadata = {
  title: "Gestione Commesse ESG",
  description: "Cruscotto commesse e servizi — uso interno",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();

  return (
    <html lang="it" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <h1 className="text-lg font-semibold text-ink-primary">
              Gestione Commesse ESG
            </h1>
            {session && (
              <nav className="flex items-center gap-4 text-sm text-ink-secondary">
                <Link href="/" className="hover:text-ink-primary">
                  Cruscotto
                </Link>
                <Link href="/servizi" className="hover:text-ink-primary">
                  Servizi
                </Link>
                <Link href="/controllo-ore" className="hover:text-ink-primary">
                  Controllo ore
                </Link>
                <Link href="/commesse/nuova" className="font-medium text-accent hover:underline">
                  + Nuova commessa
                </Link>
                {session.role === "admin" && (
                  <Link href="/admin" className="hover:text-ink-primary">
                    Admin
                  </Link>
                )}
                <span className="text-ink-muted">|</span>
                <span className="text-ink-primary">{session.name}</span>
                <form action={logout}>
                  <button type="submit" className="hover:text-ink-primary hover:underline">
                    Esci
                  </button>
                </form>
              </nav>
            )}
          </div>
        </header>
        <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
