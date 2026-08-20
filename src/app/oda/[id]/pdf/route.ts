import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/dal";

// Scarica/visualizza il PDF dell'ODA (richiesta dall'utente) — una Route
// Handler, non una Server Action: serve restituire bytes grezzi con
// Content-Type/Content-Disposition, cosa che un'azione non può fare.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return new NextResponse("Ordine non valido.", { status: 400 });
  }

  const po = await db
    .selectFrom("purchaseOrder")
    .select(["pdfData", "pdfFilename"])
    .where("id", "=", id)
    .executeTakeFirst();

  if (!po || !po.pdfData) {
    return new NextResponse("Nessun PDF caricato per questo ordine.", { status: 404 });
  }

  return new NextResponse(new Uint8Array(po.pdfData), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${(po.pdfFilename ?? "ordine.pdf").replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
