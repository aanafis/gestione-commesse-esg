import { notFound } from "next/navigation";
import Link from "next/link";
import { AssignmentEditForm } from "@/components/forms/AssignmentEditForm";
import { getAssignmentForEdit } from "@/lib/queries/assignment-form";

export const dynamic = "force-dynamic";

export default async function ModificaAssegnazionePage(props: PageProps<"/assegnazioni/[id]/modifica">) {
  const { id: idParam } = await props.params;
  if (!/^\d+$/.test(idParam)) notFound();
  const id = idParam;

  const assignment = await getAssignmentForEdit(id);
  if (!assignment) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="text-sm text-ink-secondary">
          <Link href={`/servizi/${assignment.serviceId}`} className="hover:text-ink-primary hover:underline">
            {assignment.serviceCode}
          </Link>{" "}
          / Modifica assegnazione
        </div>
        <h1 className="text-2xl font-semibold text-ink-primary">
          Modifica assegnazione — {assignment.personName}
        </h1>
        <p className="text-sm text-ink-secondary">
          Persona e servizio non si cambiano da qui — solo ruolo e ore stimate.
        </p>
      </div>

      <AssignmentEditForm assignment={assignment} />
    </div>
  );
}
