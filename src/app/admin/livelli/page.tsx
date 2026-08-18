import Link from "next/link";
import { DataTable } from "@/components/DataTable";
import { getAllLevels } from "@/lib/queries/admin";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function LivelliPage() {
  const levels = await getAllLevels();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-secondary">
          Dati sensibili (§7) — tariffe orarie interne, quasi-salariali sotto GDPR.
        </p>
        <Link href="/admin/livelli/nuovo" className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white">
          + Nuovo livello
        </Link>
      </div>
      <DataTable
        rows={levels}
        getRowKey={(r) => r.id}
        columns={[
          { key: "name", label: "Livello", render: (r) => <Link href={`/admin/livelli/${r.id}`} className="hover:underline">{r.name}</Link> },
          { key: "internalCostRate", label: "Costo interno", align: "right", render: (r) => `${formatMoney(r.internalCostRate)}/h` },
          { key: "soldRate", label: "Tariffa venduta", align: "right", render: (r) => `${formatMoney(r.soldRate)}/h` },
          { key: "active", label: "Stato", render: (r) => (r.active ? "Attivo" : "Disattivo") },
        ]}
      />
    </div>
  );
}
