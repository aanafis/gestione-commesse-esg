import Link from "next/link";
import { CommessaListTable } from "@/components/CommessaListTable";
import { getCommessaList } from "@/lib/queries/commessa-list";

// Commesse — stessa impostazione di /servizi (§6.2 per analogia): tutti gli
// stati, filtro lato client (poche decine di commesse, non serve un
// round-trip al server ad ogni cambio filtro).
export const dynamic = "force-dynamic";

export default async function CommessePage() {
  const rows = await getCommessaList();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-primary">Commesse</h1>
          <p className="text-sm text-ink-secondary">Tutti gli stati — filtra sotto per stringere</p>
        </div>
        <Link
          href="/commesse/nuova"
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white"
        >
          + Nuova commessa
        </Link>
      </div>
      <CommessaListTable rows={rows} />
    </div>
  );
}
