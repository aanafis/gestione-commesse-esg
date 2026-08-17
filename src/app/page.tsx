import Link from "next/link";
import { Section, StatTile } from "@/components/StatTile";
import { AlertChip } from "@/components/AlertChip";
import {
  getActiveServiceAlerts,
  getBilling,
  getByServiceType,
  getPortfolio,
  getProgress,
  getTeamUtilisation,
} from "@/lib/queries/dashboard";
import {
  formatHours,
  formatMoney,
  formatMultiplier,
  formatNumber,
  formatPercent,
} from "@/lib/format";

// Cruscotto — SPEC.md §6.1. Sola lettura, portfolio-wide, solo servizi attivi.
// Ogni numero qui viene da una vista del database (db/migrations/0007_*);
// questa pagina si limita a leggerli e formattarli, nessun calcolo qui.
//
// Dati sempre freschi ad ogni richiesta — mai una versione pre-calcolata in
// fase di build, che mostrerebbe margini vecchi.
export const dynamic = "force-dynamic";

export default async function CruscottoPage() {
  const [portfolio, billing, progress, byServiceType, team, alerts] =
    await Promise.all([
      getPortfolio(),
      getBilling(),
      getProgress(),
      getByServiceType(),
      getTeamUtilisation(),
      getActiveServiceAlerts(),
    ]);

  const noActiveServices = portfolio.activeServicesCount === "0";

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-semibold text-ink-primary">Cruscotto</h1>
        <p className="text-sm text-ink-secondary">
          Portfolio commesse — solo servizi attivi ({portfolio.activeServicesCount})
        </p>
      </div>

      {noActiveServices && (
        <div className="rounded-lg border border-border bg-surface p-4 text-sm text-ink-secondary">
          Nessun servizio attivo ancora. I numeri sotto saranno popolati man
          mano che vengono inserite commesse e servizi.
        </div>
      )}

      {/* Billing — il numero più importante del cruscotto (§6.1): soldi già
          maturati e non ancora fatturati. */}
      <Section title="Fatturazione">
        <StatTile
          label="Da emettere ora"
          value={formatMoney(billing.issuableAmount)}
          hint={`${billing.issuableCount} SAL pronti da emettere`}
          emphasis
        />
        <StatTile
          label="Emesso, non incassato"
          value={formatMoney(billing.issuedNotCollectedAmount)}
          hint={`${billing.issuedNotCollectedCount} SAL`}
        />
        <StatTile
          label="Scaduto"
          value={formatMoney(billing.overdueAmount)}
          hint={`${billing.overdueCount} SAL`}
        />
        <StatTile
          label="Esposizione di cassa"
          value={formatMoney(billing.cashExposure)}
          hint="Fatturato fornitori − incassato"
        />
      </Section>

      <Section title="Portfolio">
        <StatTile label="Prezzo calcolato" value={formatMoney(portfolio.totalCalculatedPrice)} />
        <StatTile label="Prezzo contrattualizzato" value={formatMoney(portfolio.totalContractedPrice)} />
        <StatTile
          label="Sconto totale concesso"
          value={formatMoney(portfolio.totalDiscount)}
          hint="Negativo = margine ceduto in negoziazione"
        />
        <StatTile
          label="Margine a finire"
          value={formatMoney(portfolio.totalMarginToComplete)}
          hint={formatPercent(portfolio.totalMarginPct)}
        />
      </Section>

      <Section title="Ore">
        <StatTile label="Stimate" value={formatHours(portfolio.totalEstimatedHours)} />
        <StatTile label="Consuntivo" value={formatHours(portfolio.totalActualHours)} />
        <StatTile label="ETC" value={formatHours(portfolio.totalEtcHours)} />
        <StatTile label="EAC" value={formatHours(portfolio.totalEacHours)} />
        <StatTile
          label="Scostamento"
          value={formatHours(portfolio.totalHoursVariance)}
          hint="EAC − stimate"
        />
        <StatTile
          label="Ricavo orario effettivo"
          value={formatMoney(portfolio.totalEffectiveHourlyRevenue)}
          hint="Prezzo ore / EAC ore — se scende sotto il costo interno, il servizio perde su ore"
        />
      </Section>

      <Section title="Consulenti">
        <StatTile label="Costo a budget" value={formatMoney(portfolio.totalConsultantCostBudget)} />
        <StatTile label="Impegnato (ODA emessi)" value={formatMoney(portfolio.totalCommittedConsultantCost)} />
        <StatTile label="Ribaltato al cliente" value={formatMoney(portfolio.totalRechargedToClient)} />
        <StatTile label="Markup pianificato (media)" value={formatMultiplier(portfolio.avgPlannedMarkup)} />
        <StatTile label="Markup effettivo" value={formatMultiplier(portfolio.totalEffectiveMarkup)} />
      </Section>

      <Section title="Squadra">
        {team.map((p) => (
          <StatTile
            key={p.personId}
            label={p.name ?? "—"}
            value={formatPercent(p.utilisationPct)}
            hint={`${formatHours(p.eacHoursActive)} di ${formatHours(p.annualAvailableHours)} disponibili`}
          />
        ))}
      </Section>

      <Section title="Avanzamento">
        <StatTile label="Fasi in ritardo" value={formatNumber(progress.overduePhasesCount)} />
        <StatTile label="Offerte aperte" value={formatNumber(progress.openOffersCount)} />
        <StatTile
          label="Pipeline pesata"
          value={formatMoney(progress.weightedPipeline)}
          hint="Somma di importo × probabilità sulle offerte aperte"
        />
      </Section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Per tipo di servizio
        </h2>
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gridline text-left text-ink-secondary">
                <th className="px-4 py-2 font-medium">Tipo servizio</th>
                <th className="px-4 py-2 font-medium text-right">N.</th>
                <th className="px-4 py-2 font-medium text-right">Prezzo contrattualizzato</th>
                <th className="px-4 py-2 font-medium text-right">Margine a finire</th>
                <th className="px-4 py-2 font-medium text-right">Margine %</th>
                <th className="px-4 py-2 font-medium text-right">Ore stimate</th>
                <th className="px-4 py-2 font-medium text-right">EAC</th>
              </tr>
            </thead>
            <tbody className="[font-variant-numeric:tabular-nums]">
              {byServiceType.map((row) => (
                <tr key={row.serviceTypeId} className="border-b border-gridline last:border-0">
                  <td className="px-4 py-2 text-ink-primary">{row.serviceTypeName}</td>
                  <td className="px-4 py-2 text-right text-ink-secondary">{row.servicesCount}</td>
                  <td className="px-4 py-2 text-right text-ink-secondary">{formatMoney(row.totalContractedPrice)}</td>
                  <td className="px-4 py-2 text-right text-ink-secondary">{formatMoney(row.totalMarginToComplete)}</td>
                  <td className="px-4 py-2 text-right text-ink-secondary">{formatPercent(row.marginPct)}</td>
                  <td className="px-4 py-2 text-right text-ink-secondary">{formatHours(row.totalEstimatedHours)}</td>
                  <td className="px-4 py-2 text-right text-ink-secondary">{formatHours(row.totalEacHours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {alerts.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Servizi in attenzione
          </h2>
          <div className="flex flex-col gap-2">
            {alerts.map((a) => (
              <Link
                key={a.serviceId}
                href={`/servizi/${a.serviceId}`}
                className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 hover:border-accent"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-ink-primary">{a.code}</span>
                  <span className="text-xs text-ink-muted">Commessa {a.commessaCode}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-ink-secondary">
                    Margine {formatPercent(a.marginPct)} · Sconto {formatPercent(a.discountPct)}
                  </span>
                  <AlertChip alert={a.alert} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
