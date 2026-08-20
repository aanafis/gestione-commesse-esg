import { QuickActions } from "@/components/dashboard/QuickActions";
import { HeroStat } from "@/components/dashboard/HeroStat";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { MiniStat, MiniStatGrid } from "@/components/dashboard/MiniStat";
import { HorizontalBars, type BarRow } from "@/components/dashboard/HorizontalBars";
import { AttentionList } from "@/components/dashboard/AttentionList";
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
  toNumber,
} from "@/lib/format";

// Cruscotto — SPEC.md §6.1. Sola lettura, portfolio-wide, solo servizi attivi.
// Ogni numero qui viene da una vista del database (db/migrations/0007_*);
// questa pagina si limita a leggerli e formattarli, nessun calcolo qui.
//
// Impaginazione a card/grafici invece del solo elenco verticale di StatTile
// (richiesta dall'utente, con un mockup approvato prima di questa modifica)
// — stessi dati, stessi query, nessuna vista nuova: solo come vengono mostrati.
//
// Dati sempre freschi ad ogni richiesta — mai una versione pre-calcolata in
// fase di build, che mostrerebbe margini vecchi.
export const dynamic = "force-dynamic";

// Soglia identica a v_service_alert (§5): sotto il 10% è "margine critico".
// Riusata qui solo per il colore della barra, non per ricalcolare l'alert.
function marginBarColor(pct: number): string {
  if (pct < 0.1) return "bg-status-critical";
  if (pct < 0.25) return "bg-status-warning";
  return "bg-status-good";
}

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

  const marginByTypeRows: BarRow[] = byServiceType
    .filter((r) => r.marginPct !== null)
    .map((r) => {
      const pct = toNumber(r.marginPct) ?? 0;
      return {
        key: String(r.serviceTypeId),
        label: r.serviceTypeName ?? "—",
        value: pct,
        displayValue: formatPercent(pct),
        colorClass: marginBarColor(pct),
      };
    })
    .sort((a, b) => a.value - b.value);

  const teamRows: BarRow[] = [...team]
    .sort((a, b) => (toNumber(b.utilisationPct) ?? 0) - (toNumber(a.utilisationPct) ?? 0))
    .map((p) => ({
      key: String(p.personId),
      label: p.name ?? "—",
      value: toNumber(p.utilisationPct) ?? 0,
      displayValue: formatPercent(p.utilisationPct),
      colorClass: "bg-accent",
    }));

  return (
    <div className="flex flex-col gap-7">
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

      <QuickActions />

      {/* I 4 numeri che contano di più: quanto vale il portfolio, quanto
          margine resta, cosa è urgente ora, cosa è in ritardo. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <HeroStat
          label="Totale contrattualizzato"
          value={formatMoney(portfolio.totalContractedPrice)}
          hint={`${portfolio.activeServicesCount} servizi attivi — prezzo calcolato ${formatMoney(portfolio.totalCalculatedPrice)}`}
        />
        <HeroStat
          label="Margine a finire"
          value={formatMoney(portfolio.totalMarginToComplete)}
          hint={`${formatPercent(portfolio.totalMarginPct)} sul contrattualizzato`}
        />
        <HeroStat
          label="Da emettere ora"
          value={formatMoney(billing.issuableAmount)}
          hint={
            billing.issuableCount === "0"
              ? "Nessun SAL pronto"
              : `${billing.issuableCount} SAL pronti da emettere`
          }
        />
        <HeroStat
          label="Fasi in ritardo"
          value={formatNumber(progress.overduePhasesCount)}
          hint="Su tutti i servizi attivi — dettaglio sotto"
          tone={Number(progress.overduePhasesCount) > 0 ? "critical" : "neutral"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_1fr]">
        <DashboardCard title="Margine per tipo di servizio" meta="margine % a finire, dal più critico">
          {marginByTypeRows.length === 0 ? (
            <p className="text-sm text-ink-muted">Nessun dato ancora.</p>
          ) : (
            <>
              <HorizontalBars rows={marginByTypeRows} />
              <div className="flex flex-wrap gap-3.5 text-xs text-ink-secondary">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-status-critical" /> sotto 10% (soglia &quot;margine critico&quot;)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-status-warning" /> 10–25%
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-status-good" /> oltre 25%
                </span>
              </div>
            </>
          )}
        </DashboardCard>

        <DashboardCard title="Servizi in attenzione" meta={`${alerts.length} servizi`}>
          <AttentionList alerts={alerts} />
        </DashboardCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DashboardCard title="Fatturazione">
          <MiniStatGrid>
            <MiniStat label="Da emettere ora" value={formatMoney(billing.issuableAmount)} hint={`${billing.issuableCount} SAL`} />
            <MiniStat label="Emesso, non incassato" value={formatMoney(billing.issuedNotCollectedAmount)} hint={`${billing.issuedNotCollectedCount} SAL`} />
            <MiniStat label="Scaduto" value={formatMoney(billing.overdueAmount)} hint={`${billing.overdueCount} SAL`} tone={Number(billing.overdueCount) > 0 ? "critical" : "neutral"} />
            <MiniStat label="Esposizione di cassa" value={formatMoney(billing.cashExposure)} hint="Fatturato fornitori − incassato" />
          </MiniStatGrid>
        </DashboardCard>

        <DashboardCard title="Ore">
          <MiniStatGrid>
            <MiniStat label="Stimate" value={formatHours(portfolio.totalEstimatedHours)} />
            <MiniStat label="EAC" value={formatHours(portfolio.totalEacHours)} />
            <MiniStat label="Consuntivo" value={formatHours(portfolio.totalActualHours)} />
            <MiniStat
              label="Scostamento"
              value={formatHours(portfolio.totalHoursVariance)}
              hint="EAC − stimate"
              tone={Number(portfolio.totalHoursVariance) > 0 ? "critical" : "good"}
            />
          </MiniStatGrid>
        </DashboardCard>

        <DashboardCard title="Consulenti">
          <MiniStatGrid>
            <MiniStat label="Costo a budget" value={formatMoney(portfolio.totalConsultantCostBudget)} />
            <MiniStat label="Impegnato (ODA)" value={formatMoney(portfolio.totalCommittedConsultantCost)} />
            <MiniStat label="Ribaltato al cliente" value={formatMoney(portfolio.totalRechargedToClient)} />
            <MiniStat label="Markup pianificato" value={formatMultiplier(portfolio.avgPlannedMarkup)} />
          </MiniStatGrid>
        </DashboardCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_1fr]">
        <DashboardCard title="Utilizzo squadra" meta="EAC ore attive / ore disponibili annue">
          {teamRows.length === 0 ? (
            <p className="text-sm text-ink-muted">Nessuna persona attiva ancora.</p>
          ) : (
            <HorizontalBars rows={teamRows} />
          )}
        </DashboardCard>

        <DashboardCard title="Avanzamento">
          <MiniStatGrid>
            <MiniStat
              label="Fasi in ritardo"
              value={formatNumber(progress.overduePhasesCount)}
              tone={Number(progress.overduePhasesCount) > 0 ? "critical" : "good"}
            />
            <MiniStat label="Offerte aperte" value={formatNumber(progress.openOffersCount)} />
            <MiniStat
              label="Pipeline pesata"
              value={formatMoney(progress.weightedPipeline)}
              hint="Somma di importo × probabilità sulle offerte aperte"
              wide
            />
          </MiniStatGrid>
        </DashboardCard>
      </div>

      <DashboardCard title="Per tipo di servizio — dettaglio" meta="stessi dati del grafico sopra, in cifre">
        <div className="overflow-x-auto">
          <table className="w-full text-sm [font-variant-numeric:tabular-nums]">
            <thead>
              <tr className="border-b border-gridline text-left text-ink-secondary">
                <th className="py-2 pr-3 font-medium">Tipo servizio</th>
                <th className="px-3 py-2 text-right font-medium">N.</th>
                <th className="px-3 py-2 text-right font-medium">Prezzo contrattualizzato</th>
                <th className="px-3 py-2 text-right font-medium">Margine a finire</th>
                <th className="px-3 py-2 text-right font-medium">Margine %</th>
                <th className="px-3 py-2 text-right font-medium">Ore stimate</th>
                <th className="py-2 pl-3 text-right font-medium">EAC</th>
              </tr>
            </thead>
            <tbody>
              {byServiceType
                .filter((row) => row.servicesCount !== "0")
                .map((row) => (
                  <tr key={row.serviceTypeId} className="border-b border-gridline last:border-0">
                    <td className="py-2 pr-3 text-ink-primary">{row.serviceTypeName}</td>
                    <td className="px-3 py-2 text-right text-ink-secondary">{row.servicesCount}</td>
                    <td className="px-3 py-2 text-right text-ink-secondary">{formatMoney(row.totalContractedPrice)}</td>
                    <td className="px-3 py-2 text-right text-ink-secondary">{formatMoney(row.totalMarginToComplete)}</td>
                    <td className="px-3 py-2 text-right text-ink-secondary">{formatPercent(row.marginPct)}</td>
                    <td className="px-3 py-2 text-right text-ink-secondary">{formatHours(row.totalEstimatedHours)}</td>
                    <td className="py-2 pl-3 text-right text-ink-secondary">{formatHours(row.totalEacHours)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </DashboardCard>
    </div>
  );
}
