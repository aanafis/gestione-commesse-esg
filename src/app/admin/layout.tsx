import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";

// Ogni pagina sotto /admin passa da qui: requireAdmin() reindirizza a /
// chiunque non sia admin, anche se qualcuno indovina l'URL direttamente
// (il link in header è già nascosto ai member, ma quello da solo non basta).
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-primary">Admin</h1>
        <p className="text-sm text-ink-secondary">
          Listino tariffe, persone, clienti, fornitori, template fasi, impostazioni (§6.6).
        </p>
      </div>
      <nav className="flex flex-wrap gap-4 border-b border-gridline pb-3 text-sm text-ink-secondary">
        <Link href="/admin/livelli" className="hover:text-ink-primary">
          Livelli e tariffe
        </Link>
        <Link href="/admin/persone" className="hover:text-ink-primary">
          Persone
        </Link>
        <Link href="/admin/clienti" className="hover:text-ink-primary">
          Clienti
        </Link>
        <Link href="/admin/fornitori" className="hover:text-ink-primary">
          Fornitori
        </Link>
        <Link href="/admin/template-fasi" className="hover:text-ink-primary">
          Template fasi
        </Link>
        <Link href="/admin/impostazioni" className="hover:text-ink-primary">
          Impostazioni
        </Link>
      </nav>
      {children}
    </div>
  );
}
