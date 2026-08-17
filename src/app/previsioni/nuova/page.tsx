import { ForecastForm } from "@/components/forms/ForecastForm";
import { getAssignmentPairsForForecast, nearbyQuarters } from "@/lib/queries/forecast-form";

export const dynamic = "force-dynamic";

export default async function NuovaPrevisionePage() {
  const pairs = await getAssignmentPairsForForecast();

  const quarterOptions = nearbyQuarters(new Date(), [-1, 0, 1, 2]);
  const defaultQuarter = quarterOptions[1];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-primary">Previsione trimestrale</h1>
        <p className="text-sm text-ink-secondary">
          L&apos;ETC è un giudizio, non un calcolo (§3): guarda lo stato reale del lavoro, non
          solo quante ore restano a budget. Registrandone una nuova, quella precedente per la
          stessa coppia servizio/persona diventa storica — non viene persa.
        </p>
      </div>

      {pairs.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-ink-secondary">
          Nessuna assegnazione su servizi non chiusi ancora.
        </p>
      ) : (
        <ForecastForm pairs={pairs} quarterOptions={quarterOptions} defaultQuarter={defaultQuarter} />
      )}
    </div>
  );
}
