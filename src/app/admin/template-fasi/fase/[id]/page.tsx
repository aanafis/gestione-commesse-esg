import { notFound } from "next/navigation";
import { PhaseTemplateRowForm } from "@/components/forms/PhaseTemplateRowForm";
import { getPhaseTemplateRow } from "@/lib/queries/admin";

export const dynamic = "force-dynamic";

export default async function ModificaFaseTemplatePage(props: PageProps<"/admin/template-fasi/fase/[id]">) {
  const { id } = await props.params;
  const row = await getPhaseTemplateRow(id);
  if (!row) notFound();
  return <PhaseTemplateRowForm row={row} />;
}
