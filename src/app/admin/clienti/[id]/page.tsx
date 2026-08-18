import { notFound } from "next/navigation";
import { ClientForm } from "@/components/forms/ClientForm";
import { getClient } from "@/lib/queries/admin";

export const dynamic = "force-dynamic";

export default async function ModificaClientePage(props: PageProps<"/admin/clienti/[id]">) {
  const { id } = await props.params;
  const client = await getClient(id);
  if (!client) notFound();
  return <ClientForm client={client} />;
}
