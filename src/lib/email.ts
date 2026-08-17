import { Resend } from "resend";

// Invio reale del magic link (§7, step 5 - deployment). In sviluppo
// (AUTH_DEV_MODE=true) non viene mai chiamato — vedi src/lib/actions/auth.ts.

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY non impostata — impossibile inviare email.");
  }
  return new Resend(apiKey);
}

/**
 * Mittente di default: il dominio "onboarding@resend.dev" di Resend funziona
 * subito, senza verifica DNS — utile per partire. Per inviare da un
 * indirizzo @ilprisma.com serve prima verificare il dominio su Resend
 * (record DNS) e impostare EMAIL_FROM di conseguenza.
 */
function getFromAddress(): string {
  return process.env.EMAIL_FROM ?? "Gestione Commesse ESG <onboarding@resend.dev>";
}

export async function sendMagicLinkEmail(params: { to: string; name: string; url: string }): Promise<void> {
  const resend = getResendClient();
  const { error } = await resend.emails.send({
    from: getFromAddress(),
    to: params.to,
    subject: "Il tuo link di accesso — Gestione Commesse ESG",
    html: `
      <p>Ciao ${params.name},</p>
      <p>Ecco il tuo link per accedere a Gestione Commesse ESG. Vale 15 minuti ed è utilizzabile una sola volta.</p>
      <p><a href="${params.url}">${params.url}</a></p>
      <p style="color:#666;font-size:13px">Se non hai richiesto questo accesso, ignora pure questa email.</p>
    `,
  });
  if (error) {
    throw new Error(`Invio email fallito: ${error.message}`);
  }
}
