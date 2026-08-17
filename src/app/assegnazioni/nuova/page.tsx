import { AssignmentForm } from "@/components/forms/AssignmentForm";
import { getPeopleWithRates, getServicesForAssignmentForm } from "@/lib/queries/assignment-form";

export const dynamic = "force-dynamic";

export default async function NuovaAssegnazionePage(props: PageProps<"/assegnazioni/nuova">) {
  const searchParams = await props.searchParams;
  const initialServiceId =
    typeof searchParams.serviceId === "string" ? searchParams.serviceId : undefined;

  const [services, people] = await Promise.all([
    getServicesForAssignmentForm(),
    getPeopleWithRates(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-primary">Assegna risorsa</h1>
        <p className="text-sm text-ink-secondary">
          È qui che nasce il prezzo (§6.5): mentre inserisci le ore, guarda a destra tariffa,
          prezzo e margine dell&apos;assegnazione, e lo scarto rispetto al contrattualizzato.
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
        <AssignmentForm services={services} people={people} initialServiceId={initialServiceId} />
      )}
    </div>
  );
}
