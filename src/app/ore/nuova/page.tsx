import { TimeEntryForm } from "@/components/forms/TimeEntryForm";
import {
  getPeopleForTimeEntryForm,
  getPhasesForTimeEntryForm,
  getServicesForTimeEntryForm,
} from "@/lib/queries/time-entry-form";

export const dynamic = "force-dynamic";

export default async function NuovaOraPage(props: PageProps<"/ore/nuova">) {
  const searchParams = await props.searchParams;
  const initialServiceId = typeof searchParams.serviceId === "string" ? searchParams.serviceId : undefined;

  const [services, people, phases] = await Promise.all([
    getServicesForTimeEntryForm(),
    getPeopleForTimeEntryForm(),
    getPhasesForTimeEntryForm(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-primary">Registra ore</h1>
        <p className="text-sm text-ink-secondary">
          Inserimento manuale di una singola riga — per un mese intero dal timesheet usa{" "}
          <a href="/ore/importa" className="text-accent hover:underline">
            l&apos;import da CSV
          </a>
          .
        </p>
      </div>

      {services.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-ink-secondary">
          Nessun servizio non chiuso ancora.{" "}
          <a href="/servizi/nuovo" className="text-accent hover:underline">
            Creane uno prima
          </a>
          .
        </p>
      ) : (
        <TimeEntryForm services={services} people={people} phases={phases} initialServiceId={initialServiceId} />
      )}
    </div>
  );
}
