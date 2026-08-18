import Link from "next/link";
import { DataTable } from "@/components/DataTable";
import { getAllPeople } from "@/lib/queries/admin";
import { formatHours } from "@/lib/format";
import { PERSON_ROLE_LABELS, label } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function PersonePage() {
  const people = await getAllPeople();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-secondary">
          Disattivare una persona qui le chiude subito l&apos;accesso (§7).
        </p>
        <Link href="/admin/persone/nuovo" className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white">
          + Nuova persona
        </Link>
      </div>
      <DataTable
        rows={people}
        getRowKey={(r) => r.id}
        columns={[
          { key: "name", label: "Nome", render: (r) => <Link href={`/admin/persone/${r.id}`} className="hover:underline">{r.name}</Link> },
          { key: "email", label: "Email" },
          { key: "levelName", label: "Livello" },
          { key: "annualAvailableHours", label: "Ore/anno", align: "right", render: (r) => formatHours(r.annualAvailableHours) },
          { key: "role", label: "Ruolo", render: (r) => label(PERSON_ROLE_LABELS, r.role) },
          { key: "active", label: "Stato", render: (r) => (r.active ? "Attivo" : "Disattivo") },
        ]}
      />
    </div>
  );
}
