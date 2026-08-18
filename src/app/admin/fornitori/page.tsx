import Link from "next/link";
import { DataTable } from "@/components/DataTable";
import { getAllSuppliers } from "@/lib/queries/admin";
import { SUPPLIER_CATEGORY_LABELS, label } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function FornitoriPage() {
  const suppliers = await getAllSuppliers();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-secondary">Anagrafica fornitori per gli ODA.</p>
        <Link href="/admin/fornitori/nuovo" className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white">
          + Nuovo fornitore
        </Link>
      </div>
      <DataTable
        rows={suppliers}
        getRowKey={(r) => r.id}
        emptyLabel="Nessun fornitore ancora."
        columns={[
          { key: "code", label: "Codice", render: (r) => <Link href={`/admin/fornitori/${r.id}`} className="hover:underline">{r.code}</Link> },
          { key: "name", label: "Ragione sociale" },
          { key: "category", label: "Categoria", render: (r) => label(SUPPLIER_CATEGORY_LABELS, r.category) },
          { key: "contactName", label: "Referente", render: (r) => r.contactName ?? "–" },
          { key: "email", label: "Email", render: (r) => r.email ?? "–" },
        ]}
      />
    </div>
  );
}
