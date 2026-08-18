import { notFound } from "next/navigation";
import { SupplierForm } from "@/components/forms/SupplierForm";
import { getSupplier } from "@/lib/queries/admin";

export const dynamic = "force-dynamic";

export default async function ModificaFornitorePage(props: PageProps<"/admin/fornitori/[id]">) {
  const { id } = await props.params;
  const supplier = await getSupplier(id);
  if (!supplier) notFound();
  return <SupplierForm supplier={supplier} />;
}
