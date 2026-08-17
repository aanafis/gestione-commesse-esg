import Link from "next/link";
import { ServiceListTable } from "@/components/ServiceListTable";
import { getServiceList } from "@/lib/queries/service-list";

// Servizi — SPEC.md §6.2. Tabella filtrabile, un alert colorato per riga.
// Filtri e ordinamento lato client: la lista è piccola (10-30 servizi
// attivi per volta, spec §1) e il filtro dev'essere istantaneo, non un
// round-trip al server ad ogni cambio.
export const dynamic = "force-dynamic";

export default async function ServiziPage() {
  const rows = await getServiceList();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-primary">Servizi</h1>
          <p className="text-sm text-ink-secondary">Tutti gli stati — filtra sotto per stringere</p>
        </div>
        <Link
          href="/servizi/nuovo"
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white"
        >
          + Nuovo servizio
        </Link>
      </div>
      <ServiceListTable rows={rows} />
    </div>
  );
}
