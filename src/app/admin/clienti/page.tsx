import Link from "next/link";
import { DataTable } from "@/components/DataTable";
import { getAllClients } from "@/lib/queries/admin";

export const dynamic = "force-dynamic";

export default async function ClientiPage() {
  const clients = await getAllClients();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-secondary">Anagrafica clienti.</p>
        <Link href="/admin/clienti/nuovo" className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white">
          + Nuovo cliente
        </Link>
      </div>
      <DataTable
        rows={clients}
        getRowKey={(r) => r.id}
        emptyLabel="Nessun cliente ancora."
        columns={[
          { key: "name", label: "Nome", render: (r) => <Link href={`/admin/clienti/${r.id}`} className="hover:underline">{r.name}</Link> },
          { key: "vatNumber", label: "P.IVA", render: (r) => r.vatNumber ?? "–" },
          { key: "notes", label: "Note", render: (r) => r.notes ?? "–" },
        ]}
      />
    </div>
  );
}
