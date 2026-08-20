import { PurchaseOrderForm } from "@/components/forms/PurchaseOrderForm";
import {
  getApprovalThresholds,
  getApproversForSelect,
  getServicesForPurchaseOrderForm,
  getSuppliersForSelect,
} from "@/lib/queries/purchase-order-form";

export const dynamic = "force-dynamic";

export default async function NuovoOdaPage(props: PageProps<"/oda/nuovo">) {
  const searchParams = await props.searchParams;
  const initialServiceId =
    typeof searchParams.serviceId === "string" ? searchParams.serviceId : undefined;
  const initialSupplierId =
    typeof searchParams.supplierId === "string" ? searchParams.supplierId : undefined;

  const [suppliers, services, approvers, thresholds] = await Promise.all([
    getSuppliersForSelect(),
    getServicesForPurchaseOrderForm(),
    getApproversForSelect(),
    getApprovalThresholds(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-primary">Nuovo ordine di acquisto</h1>
        <p className="text-sm text-ink-secondary">
          Nessun lavoro dal fornitore senza un ordine (§8) — registralo prima che inizi il
          lavoro, non quando arriva la fattura. Un ordine può coprire più servizi.
        </p>
      </div>

      {suppliers.length === 0 || services.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-ink-secondary">
          Servono almeno un fornitore e un servizio non chiuso per registrare un ordine.
        </p>
      ) : (
        <PurchaseOrderForm
          suppliers={suppliers}
          services={services}
          approvers={approvers}
          thresholds={thresholds}
          initialServiceId={initialServiceId}
          initialSupplierId={initialSupplierId}
        />
      )}
    </div>
  );
}
