import { notFound } from "next/navigation";
import Link from "next/link";
import { CommessaEditForm } from "@/components/forms/CommessaEditForm";
import { getClientsForSelect, getCommessaForEdit } from "@/lib/queries/commessa-form";
import { toDateInputValue } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ModificaCommessaPage(props: PageProps<"/commesse/[id]/modifica">) {
  const { id: idParam } = await props.params;
  if (!/^\d+$/.test(idParam)) notFound();
  const id = idParam;

  const [commessa, clients] = await Promise.all([getCommessaForEdit(id), getClientsForSelect()]);
  if (!commessa) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="text-sm text-ink-secondary">
          <Link href="/commesse" className="hover:text-ink-primary hover:underline">
            Commesse
          </Link>{" "}
          / {commessa.code} / Modifica
        </div>
        <h1 className="text-2xl font-semibold text-ink-primary">Modifica commessa</h1>
        <p className="text-sm text-ink-secondary">Il codice non si cambia da qui.</p>
      </div>

      <CommessaEditForm
        commessa={{
          id: commessa.id,
          code: commessa.code,
          clientId: commessa.clientId,
          assetName: commessa.assetName,
          clientContact: commessa.clientContact,
          startDate: toDateInputValue(commessa.startDate),
          endDate: toDateInputValue(commessa.endDate),
          status: commessa.status,
          contractValue: commessa.contractValue,
        }}
        clients={clients}
      />
    </div>
  );
}
