import { notFound } from "next/navigation";
import Link from "next/link";
import { ServiceEditForm } from "@/components/forms/ServiceEditForm";
import {
  getActivePeopleForSelect,
  getServiceForEdit,
  getServiceTypesForSelect,
} from "@/lib/queries/service-form";
import { toDateInputValue } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ModificaServizioPage(props: PageProps<"/servizi/[id]/modifica">) {
  const { id: idParam } = await props.params;
  if (!/^\d+$/.test(idParam)) notFound();
  const id = idParam;

  const [service, serviceTypes, people] = await Promise.all([
    getServiceForEdit(id),
    getServiceTypesForSelect(),
    getActivePeopleForSelect(),
  ]);
  if (!service) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="text-sm text-ink-secondary">
          <Link href={`/servizi/${id}`} className="hover:text-ink-primary hover:underline">
            {service.code}
          </Link>{" "}
          / Modifica
        </div>
        <h1 className="text-2xl font-semibold text-ink-primary">Modifica servizio</h1>
        <p className="text-sm text-ink-secondary">
          Commessa e codice non si cambiano da qui. Le fasi si aggiornano da &quot;Aggiorna
          avanzamento&quot;, nella scheda del servizio.
        </p>
      </div>

      <ServiceEditForm
        service={{
          id: service.id,
          code: service.code,
          commessaCode: service.commessaCode,
          serviceTypeId: service.serviceTypeId,
          variant: service.variant,
          pmId: service.pmId,
          startDate: toDateInputValue(service.startDate),
          endDate: toDateInputValue(service.endDate),
          status: service.status,
          consultantCostBudget: service.consultantCostBudget,
          markup: service.markup,
          contractedPrice: service.contractedPrice,
        }}
        serviceTypes={serviceTypes}
        people={people}
      />
    </div>
  );
}
