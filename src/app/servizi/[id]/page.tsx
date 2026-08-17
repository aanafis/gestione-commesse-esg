import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertChip } from "@/components/AlertChip";
import { Breakdown, BreakdownRow, Card } from "@/components/Breakdown";
import { StatTile } from "@/components/StatTile";
import { Tabs } from "@/components/Tabs";
import { DataTable } from "@/components/DataTable";
import {
  getAssignments,
  getForecasts,
  getMilestones,
  getPhases,
  getPurchaseOrderLines,
  getServiceAlert,
  getServiceHeader,
  getServiceMetrics,
  getTimeEntries,
} from "@/lib/queries/service-detail";
import { formatDate, formatHours, formatMoney, formatMultiplier, formatPercent } from "@/lib/format";
import {
  COLLECTION_STATUS_LABELS,
  MILESTONE_BASIS_LABELS,
  MILESTONE_TYPE_LABELS,
  PHASE_STATUS_LABELS,
  PO_STATUS_LABELS,
  PROJECT_ROLE_LABELS,
  SERVICE_STATUS_LABELS,
  TIME_ENTRY_SOURCE_LABELS,
  label,
} from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function ServiceDetailPage(props: PageProps<"/servizi/[id]">) {
  const { id: idParam } = await props.params;
  // id come stringa: le colonne bigint arrivano come stringa da Postgres
  // (vedi service-detail.ts). Validiamo solo il formato dell'URL.
  if (!/^\d+$/.test(idParam)) notFound();
  const id = idParam;

  const header = await getServiceHeader(id);
  if (!header) notFound();

  const [metrics, alert, phases, milestones, assignments, poLines, timeEntries, forecasts] =
    await Promise.all([
      getServiceMetrics(id),
      getServiceAlert(id),
      getPhases(id),
      getMilestones(id),
      getAssignments(id),
      getPurchaseOrderLines(id),
      getTimeEntries(id),
      getForecasts(id),
    ]);

  const overduePhases = phases.filter((p) => p.status === "overdue");
  const issuableMilestones = milestones.filter((m) => m.isIssuable);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="text-sm text-ink-secondary">
          <Link href="/" className="hover:text-ink-primary hover:underline">
            Cruscotto
          </Link>{" "}
          / Commessa {header.commessaCode}
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-ink-primary">{header.code}</h1>
          {alert && <AlertChip alert={alert.alert} />}
        </div>
        <p className="text-sm text-ink-secondary">
          {header.serviceTypeName}
          {header.variant ? ` · ${header.variant}` : ""} — {header.clientName}
          {header.assetName ? `, ${header.assetName}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sinistra: identità + situazione */}
        <Card title="Identità">
          <div className="flex flex-col gap-2 text-sm">
            <BreakdownRow label="Stato" value={label(SERVICE_STATUS_LABELS, header.status)} />
            <BreakdownRow label="Project manager" value={header.pmName ?? "–"} />
            <BreakdownRow label="Cliente" value={header.clientName} />
            <BreakdownRow label="Asset" value={header.assetName ?? "–"} />
            <BreakdownRow label="Inizio" value={formatDate(header.startDate)} />
            <BreakdownRow label="Fine prevista" value={formatDate(header.endDate)} />
          </div>

          <h4 className="mt-4 mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Fasi in ritardo ({overduePhases.length})
          </h4>
          {overduePhases.length === 0 ? (
            <p className="text-sm text-ink-muted">Nessuna.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm text-ink-secondary">
              {overduePhases.map((p) => (
                <li key={p.phaseId}>
                  {p.name} — {p.daysLate} giorni di ritardo
                </li>
              ))}
            </ul>
          )}

          <h4 className="mt-4 mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            SAL emettibili ora ({issuableMilestones.length})
          </h4>
          {issuableMilestones.length === 0 ? (
            <p className="text-sm text-ink-muted">Nessuno.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm text-ink-secondary">
              {issuableMilestones.map((m) => (
                <li key={m.milestoneId}>
                  {label(MILESTONE_TYPE_LABELS, m.type)} — {formatMoney(m.amount)}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Centro: composizione del prezzo */}
        <Card title="Composizione prezzo">
          {metrics ? (
            <>
              <Breakdown>
                <BreakdownRow label="Costo consulenti a budget" value={formatMoney(metrics.consultantCostBudget)} />
                <BreakdownRow label={`× markup (${formatMultiplier(metrics.markup)})`} value="" op="×" />
                <BreakdownRow label="Prezzo consulenti" value={formatMoney(metrics.consultantPrice)} emphasis />
                <BreakdownRow label="Prezzo ore" value={formatMoney(metrics.hoursPrice)} op="+" />
                <BreakdownRow label="Prezzo calcolato" value={formatMoney(metrics.calculatedPrice)} emphasis />
                <BreakdownRow label="Prezzo contrattualizzato" value={formatMoney(metrics.contractedPrice)} op="−" />
                <BreakdownRow
                  label="Sconto"
                  value={`${formatMoney(metrics.discount)} (${formatPercent(metrics.discountPct)})`}
                  emphasis
                  hint="Negativo = margine ceduto in negoziazione"
                />
              </Breakdown>

              <h4 className="mt-4 mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Costo → margine
              </h4>
              <Breakdown>
                <BreakdownRow label="Costo ore a finire" value={formatMoney(metrics.hoursCostToComplete)} />
                <BreakdownRow label="Costo consulenti a finire" value={formatMoney(metrics.consultantCostToComplete)} op="+" />
                <BreakdownRow label="Costo totale a finire" value={formatMoney(metrics.totalCostToComplete)} emphasis />
                <BreakdownRow
                  label="Margine a finire"
                  value={`${formatMoney(metrics.marginToComplete)} (${formatPercent(metrics.marginPct)})`}
                  emphasis
                />
                <BreakdownRow label="— di cui margine ore" value={formatMoney(metrics.hoursMargin)} />
                <BreakdownRow label="— di cui margine consulenti" value={formatMoney(metrics.consultantMargin)} />
              </Breakdown>
            </>
          ) : (
            <p className="text-sm text-ink-muted">Dati non disponibili.</p>
          )}
        </Card>

        {/* Destra: ore e fatturazione */}
        <Card title="Ore e fatturazione">
          {metrics && (
            <div className="grid grid-cols-2 gap-3">
              <StatTile label="Stimate" value={formatHours(metrics.estimatedHours)} />
              <StatTile label="Consuntivo" value={formatHours(metrics.actualHours)} />
              <StatTile label="Consumate %" value={formatPercent(metrics.hoursConsumedPct)} />
              <StatTile label="Avanzamento fasi %" value={formatPercent(metrics.phaseProgressPct)} />
              <StatTile label="ETC" value={formatHours(metrics.etcHours)} />
              <StatTile label="EAC" value={formatHours(metrics.eacHours)} />
              <StatTile
                label="Scostamento"
                value={formatHours(metrics.hoursVariance)}
                hint={
                  metrics.hoursVariance && Number(metrics.hoursVariance) > 0
                    ? "Sopra la stima"
                    : undefined
                }
              />
              <StatTile
                label="Gap ore/avanzamento"
                value={formatPercent(metrics.hoursProgressGap)}
                hint="Consumate % − avanzamento %"
              />
              <StatTile label="Fatturato al cliente" value={formatMoney(metrics.invoicedToClient)} />
              <StatTile label="Incassato" value={formatMoney(metrics.collected)} />
              <StatTile label="Da fatturare" value={formatMoney(metrics.toBeInvoiced)} emphasis />
            </div>
          )}
        </Card>
      </div>

      <Tabs
        tabs={[
          {
            label: "Assegnazioni",
            count: assignments.length,
            content: (
              <div className="flex flex-col gap-3">
                <div>
                  <Link
                    href={`/assegnazioni/nuova?serviceId=${id}`}
                    className="inline-block rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white"
                  >
                    + Assegna risorsa
                  </Link>
                </div>
                <DataTable
                rows={assignments}
                getRowKey={(r) => r.assignmentId}
                emptyLabel="Nessuna risorsa assegnata."
                columns={[
                  { key: "personName", label: "Persona" },
                  { key: "projectRole", label: "Ruolo", render: (r) => label(PROJECT_ROLE_LABELS, r.projectRole) },
                  { key: "estimatedHours", label: "Stimate", align: "right", render: (r) => formatHours(r.estimatedHours) },
                  { key: "actualHours", label: "Consuntivo", align: "right", render: (r) => formatHours(r.actualHours) },
                  { key: "etcHours", label: "ETC", align: "right", render: (r) => formatHours(r.etcHours) },
                  { key: "eacHours", label: "EAC", align: "right", render: (r) => formatHours(r.eacHours) },
                  { key: "variance", label: "Scostamento", align: "right", render: (r) => formatHours(r.variance) },
                  { key: "consumedPct", label: "Consumate %", align: "right", render: (r) => formatPercent(r.consumedPct) },
                  { key: "alert", label: "Alert", render: (r) => <AlertChip alert={r.alert} /> },
                ]}
                />
              </div>
            ),
          },
          {
            label: "Fasi",
            count: phases.length,
            content: (
              <div className="flex flex-col gap-3">
                <div>
                  <Link
                    href={`/fasi/aggiorna?serviceId=${id}`}
                    className="inline-block rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white"
                  >
                    Aggiorna avanzamento
                  </Link>
                </div>
                <DataTable
                  rows={phases}
                  getRowKey={(r) => r.phaseId}
                  emptyLabel="Nessuna fase definita."
                  columns={[
                    { key: "name", label: "Fase" },
                    { key: "status", label: "Stato", render: (r) => label(PHASE_STATUS_LABELS, r.status) },
                    { key: "baselineDate", label: "Baseline", render: (r) => formatDate(r.baselineDate) },
                    { key: "plannedDate", label: "Pianificata", render: (r) => formatDate(r.plannedDate) },
                    { key: "actualDate", label: "Effettiva", render: (r) => formatDate(r.actualDate) },
                    { key: "progressPct", label: "Avanzamento", align: "right", render: (r) => formatPercent(r.progressPct) },
                    { key: "daysLate", label: "Giorni di ritardo", align: "right", render: (r) => r.daysLate ?? "–" },
                    { key: "indicativeHours", label: "Ore indicative", align: "right", render: (r) => formatHours(r.indicativeHours) },
                  ]}
                />
              </div>
            ),
          },
          {
            label: "SAL",
            count: milestones.length,
            content: (
              <DataTable
                rows={milestones}
                getRowKey={(r) => r.milestoneId}
                emptyLabel="Nessun SAL definito."
                columns={[
                  { key: "type", label: "Tipo", render: (r) => label(MILESTONE_TYPE_LABELS, r.type) },
                  { key: "basis", label: "Base", render: (r) => label(MILESTONE_BASIS_LABELS, r.basis) },
                  { key: "amount", label: "Importo", align: "right", render: (r) => formatMoney(r.amount) },
                  { key: "triggerPhaseName", label: "Fase trigger", render: (r) => r.triggerPhaseName ?? "–" },
                  { key: "plannedIssueDate", label: "Emissione prevista", render: (r) => formatDate(r.plannedIssueDate) },
                  { key: "issueDate", label: "Emesso il", render: (r) => formatDate(r.issueDate) },
                  {
                    key: "collectionStatus",
                    label: "Stato incasso",
                    render: (r) => (
                      <span className="flex items-center gap-2">
                        {label(COLLECTION_STATUS_LABELS, r.collectionStatus)}
                        {r.isIssuable && <AlertChip alert="SAL DA EMETTERE" />}
                      </span>
                    ),
                  },
                ]}
              />
            ),
          },
          {
            label: "ODA",
            count: poLines.length,
            content: (
              <div className="flex flex-col gap-3">
                <div>
                  <Link
                    href={`/oda/nuovo?serviceId=${id}`}
                    className="inline-block rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white"
                  >
                    + Nuovo ODA
                  </Link>
                </div>
                <DataTable
                  rows={poLines}
                  getRowKey={(r) => r.lineId}
                  emptyLabel="Nessun ordine di acquisto su questo servizio."
                  columns={[
                    { key: "number", label: "N. ordine" },
                    { key: "supplierName", label: "Fornitore" },
                    { key: "poStatus", label: "Stato", render: (r) => label(PO_STATUS_LABELS, r.poStatus) },
                    { key: "consultantCost", label: "Costo consulente", align: "right", render: (r) => formatMoney(r.consultantCost) },
                    { key: "rechargedToClient", label: "Ribaltato al cliente", align: "right", render: (r) => formatMoney(r.rechargedToClient) },
                    { key: "markupApplied", label: "Markup", align: "right", render: (r) => formatMultiplier(r.markupApplied) },
                    { key: "lineMargin", label: "Margine riga", align: "right", render: (r) => formatMoney(r.lineMargin) },
                    { key: "isCommitted", label: "Impegnato", render: (r) => (r.isCommitted ? "Sì" : "No") },
                  ]}
                />
              </div>
            ),
          },
          {
            label: "Ore",
            count: timeEntries.length,
            content: (
              <DataTable
                rows={timeEntries}
                getRowKey={(r) => r.id}
                emptyLabel="Nessuna ora registrata."
                columns={[
                  { key: "month", label: "Mese" },
                  { key: "personName", label: "Persona" },
                  { key: "phaseName", label: "Fase", render: (r) => r.phaseName ?? "–" },
                  { key: "hours", label: "Ore", align: "right", render: (r) => formatHours(r.hours) },
                  { key: "source", label: "Origine", render: (r) => label(TIME_ENTRY_SOURCE_LABELS, r.source) },
                ]}
              />
            ),
          },
          {
            label: "Previsioni",
            count: forecasts.length,
            content: (
              <div className="flex flex-col gap-3">
                <div>
                  <Link
                    href="/previsioni/nuova"
                    className="inline-block rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white"
                  >
                    + Nuova previsione
                  </Link>
                </div>
                <DataTable
                  rows={forecasts}
                  getRowKey={(r) => r.id}
                  emptyLabel="Nessuna previsione registrata."
                  columns={[
                    { key: "quarter", label: "Trimestre" },
                    { key: "personName", label: "Persona" },
                    { key: "etcHours", label: "ETC", align: "right", render: (r) => formatHours(r.etcHours) },
                    { key: "isCurrent", label: "Corrente", render: (r) => (r.isCurrent ? "Sì" : "No — superata") },
                    { key: "recordedAt", label: "Registrata il", render: (r) => formatDate(r.recordedAt) },
                    { key: "notes", label: "Note", render: (r) => r.notes ?? "–" },
                  ]}
                />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
