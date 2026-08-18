import Link from "next/link";
import { DataTable } from "@/components/DataTable";
import { getPhaseTemplateRows } from "@/lib/queries/admin";
import { formatPercent } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function TemplateFasiDettaglioPage(props: PageProps<"/admin/template-fasi/[templateName]">) {
  const { templateName: encoded } = await props.params;
  const templateName = decodeURIComponent(encoded);
  const phases = await getPhaseTemplateRows(templateName);

  const totalQuota = phases.reduce((sum, p) => sum + Number(p.hoursQuotaPct), 0);
  const ok = Math.abs(totalQuota - 1) < 0.001;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/admin/template-fasi" className="text-sm text-ink-secondary hover:text-ink-primary hover:underline">
          ← Template fasi
        </Link>
        <h2 className="text-xl font-semibold text-ink-primary">{templateName}</h2>
        <p className={`text-sm ${ok ? "text-ink-secondary" : "font-semibold text-status-critical"}`}>
          Somma quote ore: {formatPercent(totalQuota)} {ok ? "" : "— non torna a 100%"}
        </p>
      </div>
      <DataTable
        rows={phases}
        getRowKey={(r) => r.id}
        emptyLabel="Nessuna fase per questo template."
        columns={[
          { key: "sortOrder", label: "#", align: "right" },
          { key: "phaseName", label: "Fase", render: (r) => <Link href={`/admin/template-fasi/fase/${r.id}`} className="hover:underline">{r.phaseName}</Link> },
          { key: "expectedDeliverable", label: "Deliverable", render: (r) => r.expectedDeliverable ?? "–" },
          { key: "contractualMilestone", label: "Milestone", render: (r) => (r.contractualMilestone ? "Sì" : "No") },
          { key: "durationDays", label: "Durata (gg)", align: "right" },
          { key: "hoursQuotaPct", label: "Quota ore", align: "right", render: (r) => formatPercent(r.hoursQuotaPct) },
        ]}
      />
    </div>
  );
}
