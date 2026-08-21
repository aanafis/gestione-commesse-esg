import Link from "next/link";
import { DataTable, type Column } from "@/components/DataTable";
import { PersonHoursTable } from "@/components/PersonHoursTable";
import {
  getActivePeople,
  getAssignmentsHoursControl,
  getCommesseHoursControl,
  getMonthlyHoursByPerson,
  getServicesHoursControl,
  last12Months,
} from "@/lib/queries/hours-control";
import { formatHours, formatMonthLabel, formatPercent } from "@/lib/format";

export const dynamic = "force-dynamic";

type MonthlyRow = { personId: string; personName: string; total: number } & Record<string, number | string>;

export default async function ControlloOrePage() {
  const months = last12Months(new Date());

  const [commesse, services, assignments, people, monthlyRaw] = await Promise.all([
    getCommesseHoursControl(),
    getServicesHoursControl(),
    getAssignmentsHoursControl(),
    getActivePeople(),
    getMonthlyHoursByPerson(months),
  ]);

  // Pivot: una riga per persona attiva, una colonna per mese (anche a 0),
  // così la matrice mostra sempre tutta la squadra, non solo chi ha ore
  // registrate nella finestra.
  const monthlyRows: MonthlyRow[] = people.map((p) => {
    const row: MonthlyRow = { personId: p.id, personName: p.name, total: 0 };
    for (const m of months) row[m] = 0;
    for (const entry of monthlyRaw) {
      // month/personId arrivano tipizzati nullable perché vengono da una
      // vista aggregata (Postgres non garantisce la non-nullabilità delle
      // colonne calcolate in fase di introspezione) — qui, filtrati come
      // sopra, non lo sono mai davvero.
      if (entry.personId === p.id && entry.month) {
        const hours = Number(entry.hours);
        row[entry.month] = hours;
        row.total = (row.total as number) + hours;
      }
    }
    return row;
  });

  const monthlyColumns: Column<MonthlyRow>[] = [
    { key: "personName", label: "Persona" },
    ...months.map((m) => ({
      key: m,
      label: formatMonthLabel(m),
      align: "right" as const,
      render: (r: MonthlyRow) => formatHours(r[m] as number),
    })),
    { key: "total", label: "Totale", align: "right", render: (r) => formatHours(r.total) },
  ];

  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-primary">Controllo ore</h1>
          <p className="text-sm text-ink-secondary">
            Servizi non chiusi (attivi, sospesi, in certificazione)
          </p>
        </div>
        <Link
          href="/ore/importa"
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white"
        >
          Importa ore da CSV
        </Link>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Per commessa
        </h2>
        <DataTable
          rows={commesse}
          getRowKey={(r) => r.commessaId}
          emptyLabel="Nessuna commessa con servizi non chiusi."
          columns={[
            { key: "code", label: "Commessa" },
            { key: "servicesCount", label: "N. servizi", align: "right" },
            { key: "estimatedHours", label: "Stimate", align: "right", render: (r) => formatHours(r.estimatedHours) },
            { key: "actualHours", label: "Consuntivo", align: "right", render: (r) => formatHours(r.actualHours) },
            { key: "hoursConsumedPct", label: "Consumate %", align: "right", render: (r) => formatPercent(r.hoursConsumedPct) },
            { key: "phaseProgressPct", label: "Avanzamento %", align: "right", render: (r) => formatPercent(r.phaseProgressPct) },
            {
              key: "hoursProgressGap",
              label: "Delta",
              align: "right",
              render: (r) => {
                const gap = r.hoursProgressGap === null ? null : Number(r.hoursProgressGap);
                const flagged = gap !== null && gap > 0.15;
                return (
                  <span className={flagged ? "font-semibold text-status-critical" : undefined}>
                    {formatPercent(r.hoursProgressGap)}
                  </span>
                );
              },
            },
            { key: "etcHours", label: "ETC", align: "right", render: (r) => formatHours(r.etcHours) },
            { key: "eacHours", label: "EAC", align: "right", render: (r) => formatHours(r.eacHours) },
            { key: "hoursVariance", label: "Scostamento", align: "right", render: (r) => formatHours(r.hoursVariance) },
            { key: "hoursMargin", label: "Margine ore", align: "right", render: (r) => formatHours(r.hoursMargin) },
          ]}
        />
        <p className="text-xs text-ink-muted">
          Somma dei servizi non chiusi della commessa — avanzamento % è una media pesata sulle ore
          stimate di ogni servizio, non una semplice media tra servizi.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Per servizio
        </h2>
        <DataTable
          rows={services}
          getRowKey={(r) => r.serviceId}
          emptyLabel="Nessun servizio non chiuso."
          columns={[
            {
              key: "code",
              label: "Servizio",
              render: (r) => (
                <Link href={`/servizi/${r.serviceId}`} className="hover:underline">
                  {r.code}
                </Link>
              ),
            },
            { key: "commessaCode", label: "Commessa" },
            { key: "estimatedHours", label: "Stimate", align: "right", render: (r) => formatHours(r.estimatedHours) },
            { key: "actualHours", label: "Consuntivo", align: "right", render: (r) => formatHours(r.actualHours) },
            { key: "hoursConsumedPct", label: "Consumate %", align: "right", render: (r) => formatPercent(r.hoursConsumedPct) },
            { key: "phaseProgressPct", label: "Avanzamento %", align: "right", render: (r) => formatPercent(r.phaseProgressPct) },
            {
              key: "hoursProgressGap",
              label: "Delta",
              align: "right",
              render: (r) => {
                const gap = r.hoursProgressGap === null ? null : Number(r.hoursProgressGap);
                const flagged = gap !== null && gap > 0.15;
                return (
                  <span className={flagged ? "font-semibold text-status-critical" : undefined}>
                    {formatPercent(r.hoursProgressGap)}
                  </span>
                );
              },
            },
            { key: "etcHours", label: "ETC", align: "right", render: (r) => formatHours(r.etcHours) },
            { key: "eacHours", label: "EAC", align: "right", render: (r) => formatHours(r.eacHours) },
            { key: "hoursVariance", label: "Scostamento", align: "right", render: (r) => formatHours(r.hoursVariance) },
            { key: "hoursMargin", label: "Margine ore", align: "right", render: (r) => formatHours(r.hoursMargin) },
          ]}
        />
        <p className="text-xs text-ink-muted">
          Delta = ore consumate % − avanzamento fasi %. Sopra 15 punti (in rosso): si stanno
          bruciando ore più in fretta di quanto il lavoro avanzi — si vede prima che nel margine.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Per persona
        </h2>
        <PersonHoursTable rows={assignments} />
        <p className="text-xs text-ink-muted">
          Clicca una persona per vedere le sue ore suddivise per commessa e per servizio.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Matrice mensile — ultimi 12 mesi
        </h2>
        <DataTable
          rows={monthlyRows}
          getRowKey={(r) => r.personId}
          emptyLabel="Nessuna persona attiva."
          columns={monthlyColumns}
        />
      </section>
    </div>
  );
}
