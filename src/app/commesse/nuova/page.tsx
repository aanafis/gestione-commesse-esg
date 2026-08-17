import { CommessaForm } from "@/components/forms/CommessaForm";
import { getClientsForSelect, suggestNextCommessaCode } from "@/lib/queries/commessa-form";

export const dynamic = "force-dynamic";

export default async function NuovaCommessaPage() {
  const [clients, suggestedCode] = await Promise.all([
    getClientsForSelect(),
    suggestNextCommessaCode(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-primary">Nuova commessa</h1>
        <p className="text-sm text-ink-secondary">
          Il contenitore contrattuale — un cliente, un edificio, un contratto. I servizi
          (LEED, WELL, CRREM…) si aggiungono dopo, ciascuno con il proprio prezzo e margine.
        </p>
      </div>
      <CommessaForm clients={clients} suggestedCode={suggestedCode} />
    </div>
  );
}
