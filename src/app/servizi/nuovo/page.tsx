import { ServiceForm } from "@/components/forms/ServiceForm";
import {
  getActivePeopleForSelect,
  getCommesseForServiceForm,
  getDefaultMarkup,
  getPhaseTemplateNames,
  getServiceTypesForSelect,
} from "@/lib/queries/service-form";

export const dynamic = "force-dynamic";

export default async function NuovoServizioPage(props: PageProps<"/servizi/nuovo">) {
  const searchParams = await props.searchParams;
  const initialCommessaId =
    typeof searchParams.commessaId === "string" ? searchParams.commessaId : undefined;

  const [commesse, serviceTypes, templateNames, people, defaultMarkup] = await Promise.all([
    getCommesseForServiceForm(),
    getServiceTypesForSelect(),
    getPhaseTemplateNames(),
    getActivePeopleForSelect(),
    getDefaultMarkup(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-primary">Nuovo servizio</h1>
        <p className="text-sm text-ink-secondary">
          LEED, WELL, CRREM… ogni servizio ha il proprio codice, prezzo e margine (§1). Il
          prezzo ore si costruisce dopo, assegnando le risorse.
        </p>
      </div>

      {commesse.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-ink-secondary">
          Nessuna commessa ancora.{" "}
          <a href="/commesse/nuova" className="text-accent hover:underline">
            Creane una prima
          </a>
          .
        </p>
      ) : (
        <ServiceForm
          commesse={commesse}
          serviceTypes={serviceTypes}
          templateNames={templateNames}
          people={people}
          defaultMarkup={defaultMarkup}
          initialCommessaId={initialCommessaId}
        />
      )}
    </div>
  );
}
