import { notFound } from "next/navigation";
import Link from "next/link";
import { Breakdown, BreakdownRow, Card } from "@/components/Breakdown";
import { StatTile } from "@/components/StatTile";
import { DataTable } from "@/components/DataTable";
import { PurchaseOrderPdfControl } from "@/components/forms/PurchaseOrderPdfControl";
import { getSupplierHeader, getSupplierPurchaseOrderLines } from "@/lib/queries/supplier-detail";
import { formatMoney, formatMultiplier } from "@/lib/format";
import { PO_STATUS_LABELS, SUPPLIER_CATEGORY_LABELS, label } from "@/lib/labels";

export const dynamic = "force-dynamic";

// Scheda fornitore (richiesta dall'utente): quante commesse/servizi ha un
// consulente/fornitore esterno, con quali ODA e a che punto — oggi visibile
// solo spezzettato per servizio (tab ODA della Scheda servizio).
export default async function SchedaFornitorePage(props: PageProps<"/admin/fornitori/[id]/scheda">) {
  const { id } = await props.params;
  const supplier = await getSupplierHeader(id);
  if (!supplier) notFound();

  const lines = await getSupplierPurchaseOrderLines(id);

  const commesseCount = new Set(lines.map((l) => l.commessaCode)).size;
  const serviziCount = new Set(lines.map((l) => l.serviceId)).size;
  const totalConsultantCost = lines.reduce((sum, l) => sum + Number(l.consultantCost), 0);
  const totalRecharged = lines.reduce((sum, l) => sum + Number(l.rechargedToClient), 0);
  const totalInvoiced = lines.reduce((sum, l) => sum + Number(l.invoicedAmount), 0);
  const paidLines = lines.filter((l) => l.poStatus === "paid");
  const totalPaid = paidLines.reduce((sum, l) => sum + Number(l.consultantCost), 0);
  const pendingLines = lines.filter((l) => l.isCommitted && l.poStatus !== "paid");
  const totalPending = pendingLines.reduce((sum, l) => sum + Number(l.consultantCost), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-ink-secondary">
            <Link href="/admin/fornitori" className="hover:text-ink-primary hover:underline">
              Fornitori
            </Link>{" "}
            / {supplier.code}
          </div>
          <h1 className="text-2xl font-semibold text-ink-primary">{supplier.name}</h1>
          <p className="text-sm text-ink-secondary">{label(SUPPLIER_CATEGORY_LABELS, supplier.category)}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/oda/nuovo?supplierId=${id}`}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white"
          >
            + Collega un servizio
          </Link>
          <Link href={`/admin/fornitori/${id}`} className="text-sm text-accent hover:underline">
            Modifica anagrafica
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Anagrafica">
          <Breakdown>
            <BreakdownRow label="Referente" value={supplier.contactName ?? "–"} />
            <BreakdownRow label="Email" value={supplier.email ?? "–"} />
            <BreakdownRow label="Telefono" value={supplier.phone ?? "–"} />
            <BreakdownRow label="Termini di pagamento" value={supplier.paymentTerms ?? "–"} />
            <BreakdownRow label="P.IVA" value={supplier.vatNumber ?? "–"} />
          </Breakdown>
          {supplier.notes && <p className="mt-3 text-sm text-ink-secondary">{supplier.notes}</p>}
        </Card>

        <Card title="Commesse e servizi">
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Commesse coinvolte" value={String(commesseCount)} />
            <StatTile label="Servizi coinvolti" value={String(serviziCount)} />
            <StatTile label="Righe ODA" value={String(lines.length)} />
            <StatTile label="Impegnate" value={String(lines.filter((l) => l.isCommitted).length)} />
          </div>
        </Card>

        <Card title="Costi e pagamenti">
          <Breakdown>
            <BreakdownRow label="Costo consulente totale" value={formatMoney(totalConsultantCost)} />
            <BreakdownRow label="Ribaltato al cliente" value={formatMoney(totalRecharged)} />
            <BreakdownRow label="Fatturato dal fornitore" value={formatMoney(totalInvoiced)} />
            <BreakdownRow label="Pagato (ODA a stato 'Pagato')" value={formatMoney(totalPaid)} emphasis />
            <BreakdownRow
              label="Da pagare (impegnato, non ancora pagato)"
              value={formatMoney(totalPending)}
              emphasis
              hint="Somma del costo consulente sulle righe con ODA impegnato (emesso/consegnato/fatturato) ma non ancora a stato 'Pagato'"
            />
          </Breakdown>
        </Card>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold text-ink-primary">Ordini di acquisto</h2>
        <DataTable
          rows={lines}
          getRowKey={(r) => r.lineId}
          emptyLabel="Nessun ordine di acquisto per questo fornitore."
          columns={[
            { key: "number", label: "N. ordine" },
            {
              key: "serviceCode",
              label: "Servizio",
              render: (r) => (
                <Link href={`/servizi/${r.serviceId}`} className="hover:underline">
                  {r.serviceCode}
                </Link>
              ),
            },
            { key: "commessaCode", label: "Commessa" },
            { key: "phaseRef", label: "Prestazione", render: (r) => r.phaseRef ?? "–" },
            { key: "poStatus", label: "Stato ODA", render: (r) => label(PO_STATUS_LABELS, r.poStatus) },
            { key: "consultantCost", label: "Costo consulente", align: "right", render: (r) => formatMoney(r.consultantCost) },
            { key: "rechargedToClient", label: "Ribaltato al cliente", align: "right", render: (r) => formatMoney(r.rechargedToClient) },
            { key: "invoicedAmount", label: "Fatturato", align: "right", render: (r) => formatMoney(r.invoicedAmount) },
            { key: "lineMargin", label: "Margine", align: "right", render: (r) => formatMoney(r.lineMargin) },
            {
              key: "markupApplied",
              label: "Markup",
              align: "right",
              render: (r) =>
                r.consultantCost && Number(r.consultantCost) > 0
                  ? formatMultiplier(Number(r.rechargedToClient) / Number(r.consultantCost))
                  : "–",
            },
            { key: "isCommitted", label: "Impegnato", render: (r) => (r.isCommitted ? "Sì" : "No") },
            {
              key: "pdf",
              label: "PDF ODA",
              render: (r) => (
                <PurchaseOrderPdfControl
                  purchaseOrderId={String(r.purchaseOrderId)}
                  pdfFilename={r.pdfFilename}
                  pdfUploadedAt={r.pdfUploadedAt}
                />
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
