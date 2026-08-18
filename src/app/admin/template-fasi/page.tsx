import Link from "next/link";
import { DataTable } from "@/components/DataTable";
import { getPhaseTemplatesSummary } from "@/lib/queries/admin";
import { formatPercent } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function TemplateFasiPage() {
  const templates = await getPhaseTemplatesSummary();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-secondary">
        Le quote ore di ogni template devono sommare al 100% (§4.1) — evidenziati in rosso quelli che non tornano.
      </p>
      <DataTable
        rows={templates}
        getRowKey={(r) => r.templateName}
        columns={[
          {
            key: "templateName",
            label: "Template",
            render: (r) => (
              <Link href={`/admin/template-fasi/${encodeURIComponent(r.templateName)}`} className="hover:underline">
                {r.templateName}
              </Link>
            ),
          },
          { key: "phaseCount", label: "N. fasi", align: "right" },
          {
            key: "totalQuota",
            label: "Somma quote ore",
            align: "right",
            render: (r) => {
              const total = Number(r.totalQuota);
              const ok = Math.abs(total - 1) < 0.001;
              return <span className={ok ? undefined : "font-semibold text-status-critical"}>{formatPercent(total)}</span>;
            },
          },
        ]}
      />
    </div>
  );
}
