import { PhaseProgressForm } from "@/components/forms/PhaseProgressForm";
import { getPhasesForProgressForm } from "@/lib/queries/phase-form";
import { getActivePeopleForSelect } from "@/lib/queries/service-form";

export const dynamic = "force-dynamic";

export default async function AggiornaFasePage(props: PageProps<"/fasi/aggiorna">) {
  const searchParams = await props.searchParams;
  const initialServiceId =
    typeof searchParams.serviceId === "string" ? searchParams.serviceId : undefined;

  const [phases, people] = await Promise.all([
    getPhasesForProgressForm(),
    getActivePeopleForSelect(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-primary">Aggiorna avanzamento fase</h1>
        <p className="text-sm text-ink-secondary">
          La data baseline non si tocca più una volta confermata (§4.2) — è il riferimento
          per misurare i ritardi. La data pianificata invece si può spostare quando cambia il piano.
        </p>
      </div>

      {phases.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-ink-secondary">
          Nessuna fase su servizi non chiusi ancora.
        </p>
      ) : (
        <PhaseProgressForm phases={phases} people={people} initialServiceId={initialServiceId} />
      )}
    </div>
  );
}
