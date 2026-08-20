import Link from "next/link";

// Azioni rapide del Cruscotto (§6.1) — le maschere di inserimento più usate,
// un livello sopra la navigazione normale. Stessi href già esistenti altrove
// nell'app, nessuna nuova rotta.
const ACTIONS = [
  { href: "/commesse/nuova", label: "Nuova commessa" },
  { href: "/servizi/nuovo", label: "Nuovo servizio" },
  { href: "/assegnazioni/nuova", label: "Assegna risorsa" },
  { href: "/ore/nuova", label: "Registra ore" },
  { href: "/oda/nuovo", label: "Nuovo ODA" },
  { href: "/previsioni/nuova", label: "Previsione trimestrale" },
];

export function QuickActions() {
  return (
    <div className="flex flex-wrap gap-2">
      {ACTIONS.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className="card-shadow inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-ink-primary hover:border-accent"
        >
          <span className="h-1.5 w-1.5 flex-none rounded-full bg-accent" />
          {a.label}
        </Link>
      ))}
    </div>
  );
}
