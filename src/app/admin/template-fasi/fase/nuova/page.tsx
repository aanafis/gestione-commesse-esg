import { PhaseTemplateRowForm } from "@/components/forms/PhaseTemplateRowForm";
import { getPhaseTemplateRows } from "@/lib/queries/admin";

export const dynamic = "force-dynamic";

// Nuova fase per un template (esistente o del tutto nuovo — un template è
// semplicemente il primo insert con quel nome, vedi savePhaseTemplateRow).
// Rotta statica "nuova" invece di infilarsi in [id]: lì un id inesistente
// darebbe notFound(), qui invece serve un form vuoto.
export default async function NuovaFaseTemplatePage(props: PageProps<"/admin/template-fasi/fase/nuova">) {
  const searchParams = await props.searchParams;
  const templateName = typeof searchParams.templateName === "string" ? searchParams.templateName : "";

  const existing = templateName ? await getPhaseTemplateRows(templateName) : [];
  const nextSortOrder = existing.length > 0 ? Math.max(...existing.map((p) => p.sortOrder)) + 1 : 1;

  if (!templateName) {
    return (
      <p className="text-sm text-ink-secondary">
        Manca il nome del template — arriva qui dalla pagina di un template (esistente o dalla creazione di un
        nuovo Tipo di servizio).
      </p>
    );
  }

  return (
    <PhaseTemplateRowForm
      row={{
        id: "",
        templateName,
        sortOrder: nextSortOrder,
        phaseName: "",
        expectedDeliverable: null,
        contractualMilestone: false,
        durationDays: 0,
        hoursQuotaPct: "0",
      }}
    />
  );
}
