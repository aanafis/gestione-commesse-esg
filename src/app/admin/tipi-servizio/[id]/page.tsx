import { notFound } from "next/navigation";
import { ServiceTypeForm } from "@/components/forms/ServiceTypeForm";
import { getServiceType } from "@/lib/queries/admin";

export const dynamic = "force-dynamic";

export default async function ModificaTipoServizioPage(props: PageProps<"/admin/tipi-servizio/[id]">) {
  const { id } = await props.params;
  const serviceType = await getServiceType(id);
  if (!serviceType) notFound();

  return <ServiceTypeForm serviceType={serviceType} />;
}
