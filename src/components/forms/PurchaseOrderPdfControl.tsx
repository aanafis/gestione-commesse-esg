"use client";

import { useActionState } from "react";
import { uploadPurchaseOrderPdf, type UploadPdfFormState } from "@/lib/actions/purchase-order-pdf";
import { formatDate } from "@/lib/format";

const INITIAL_STATE: UploadPdfFormState = { status: "idle" };

/** Carica/sostituisce/scarica il PDF di un ODA (richiesta dall'utente) — un
 * file per ordine, non per riga: un ordine può coprire più servizi (§4.2),
 * lo stesso widget compare identico su ogni riga dello stesso ordine. */
export function PurchaseOrderPdfControl({
  purchaseOrderId,
  pdfFilename,
  pdfUploadedAt,
}: {
  purchaseOrderId: string;
  pdfFilename: string | null;
  pdfUploadedAt: Date | string | null;
}) {
  const [state, formAction, pending] = useActionState(uploadPurchaseOrderPdf, INITIAL_STATE);

  const currentFilename = state.status === "success" ? state.filename : pdfFilename;
  const hasFile = !!currentFilename;

  return (
    <div className="flex flex-col gap-1 text-xs">
      {hasFile && (
        <a
          href={`/oda/${purchaseOrderId}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          📄 {currentFilename}
        </a>
      )}
      {state.status !== "success" && hasFile && pdfUploadedAt && (
        <span className="text-ink-muted">Caricato il {formatDate(pdfUploadedAt)}</span>
      )}
      <form action={formAction} className="flex items-center gap-1">
        <input type="hidden" name="purchaseOrderId" value={purchaseOrderId} />
        <input
          type="file"
          name="pdf"
          accept="application/pdf"
          className="w-28 text-xs text-ink-secondary file:mr-1 file:rounded file:border-0 file:bg-accent file:px-1.5 file:py-0.5 file:text-xs file:text-white"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-accent px-2 py-0.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {pending ? "…" : hasFile ? "Sostituisci" : "Carica"}
        </button>
      </form>
      {state.status === "error" && <span className="text-status-critical">{state.error}</span>}
    </div>
  );
}
