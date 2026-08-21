import { notFound } from "next/navigation";
import { PurchaseOrderEditForm } from "@/components/forms/PurchaseOrderEditForm";
import {
  getApprovalThresholds,
  getApproversForSelect,
  getPurchaseOrderForEdit,
  getServicesForPurchaseOrderForm,
  getSuppliersForSelect,
} from "@/lib/queries/purchase-order-form";

export const dynamic = "force-dynamic";

export default async function ModificaOdaPage(props: PageProps<"/oda/[id]/modifica">) {
  const { id } = await props.params;
  if (!/^\d+$/.test(id)) notFound();

  const [purchaseOrder, suppliers, services, approvers, thresholds] = await Promise.all([
    getPurchaseOrderForEdit(id),
    getSuppliersForSelect(),
    getServicesForPurchaseOrderForm(),
    getApproversForSelect(),
    getApprovalThresholds(),
  ]);
  if (!purchaseOrder) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-primary">Modifica ordine — {purchaseOrder.number}</h1>
        <p className="text-sm text-ink-secondary">
          Aggiungi una riga per collegare un altro servizio allo stesso ordine, invece di crearne uno nuovo con lo
          stesso numero.
        </p>
      </div>

      <PurchaseOrderEditForm
        purchaseOrder={purchaseOrder}
        suppliers={suppliers}
        services={services}
        approvers={approvers}
        thresholds={thresholds}
      />
    </div>
  );
}
