import Link from "next/link";
import { DataTable } from "@/components/DataTable";
import { getAllServiceTypes } from "@/lib/queries/admin";

export const dynamic = "force-dynamic";

export default async function TipiServizioPage() {
  const serviceTypes = await getAllServiceTypes();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-secondary">
          L&apos;elenco a tendina di &quot;Tipo di servizio&quot; nella maschera Nuovo servizio (§4.1).
        </p>
        <Link
          href="/admin/tipi-servizio/nuovo"
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white"
        >
          + Nuovo tipo
        </Link>
      </div>
      <DataTable
        rows={serviceTypes}
        getRowKey={(r) => r.id}
        columns={[
          {
            key: "name",
            label: "Nome",
            render: (r) => (
              <Link href={`/admin/tipi-servizio/${r.id}`} className="hover:underline">
                {r.name}
              </Link>
            ),
          },
          { key: "sortOrder", label: "Ordine", align: "right" },
          { key: "active", label: "Stato", render: (r) => (r.active ? "Attivo" : "Disattivo") },
        ]}
      />
    </div>
  );
}
