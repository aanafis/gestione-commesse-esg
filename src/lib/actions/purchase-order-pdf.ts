"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/dal";

// PDF dell'ODA emesso (richiesta dall'utente) — un file per ordine, non per
// riga (§ commento migration 0012). Salvato come bytea in Postgres.

const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8MB — margine sotto il limite di 10MB delle Server Action (next.config.ts)

export type UploadPdfFormState = {
  status: "idle" | "error" | "success";
  error?: string;
  filename?: string;
};

export async function uploadPurchaseOrderPdf(
  _prevState: UploadPdfFormState,
  formData: FormData
): Promise<UploadPdfFormState> {
  const session = await getSession();
  if (!session) {
    return { status: "error", error: "Sessione scaduta — accedi di nuovo." };
  }

  const purchaseOrderId = String(formData.get("purchaseOrderId") ?? "");
  if (!purchaseOrderId) {
    return { status: "error", error: "Ordine non specificato." };
  }

  const file = formData.get("pdf");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", error: "Seleziona un file PDF." };
  }
  const looksLikePdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!looksLikePdf) {
    return { status: "error", error: "Il file deve essere un PDF." };
  }
  if (file.size > MAX_SIZE_BYTES) {
    return { status: "error", error: "File troppo grande — limite 8MB." };
  }

  const order = await db
    .selectFrom("purchaseOrder")
    .select("id")
    .where("id", "=", purchaseOrderId)
    .executeTakeFirst();
  if (!order) {
    return { status: "error", error: "Ordine non trovato." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  await db
    .updateTable("purchaseOrder")
    .set({
      pdfData: buffer,
      pdfFilename: file.name,
      pdfUploadedAt: new Date(),
      pdfUploadedBy: session.personId,
    })
    .where("id", "=", purchaseOrderId)
    .execute();

  return { status: "success", filename: file.name };
}
