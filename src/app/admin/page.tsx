import Link from "next/link";

const SECTIONS = [
  { href: "/admin/livelli", label: "Livelli e tariffe", hint: "Rate card per seniority — dati sensibili (§7)" },
  { href: "/admin/persone", label: "Persone", hint: "Livello, ruolo, accesso al login" },
  { href: "/admin/clienti", label: "Clienti", hint: "Anagrafica clienti" },
  { href: "/admin/fornitori", label: "Fornitori", hint: "Anagrafica fornitori per gli ODA" },
  { href: "/admin/template-fasi", label: "Template fasi", hint: "Fasi standard per tipo di servizio" },
  { href: "/admin/impostazioni", label: "Impostazioni", hint: "Soglie di approvazione, markup di default" },
];

export default function AdminIndexPage() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {SECTIONS.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4 hover:border-accent"
        >
          <span className="font-medium text-ink-primary">{s.label}</span>
          <span className="text-xs text-ink-muted">{s.hint}</span>
        </Link>
      ))}
    </div>
  );
}
