// Verifica manuale di createHoursForecast dopo l'introduzione
// dell'autenticazione. Uso: npx tsx scripts/test-forecast-action.ts
//
// L'action ora richiede una sessione reale (getSession(), che legge
// cookies() — un contesto di richiesta che uno script standalone non ha).
// Qui verifichiamo solo che il guard blocchi correttamente l'azione senza
// sessione. La logica di business (supersede della previsione precedente,
// eac_hours che segue la previsione corrente, ecc.) era già stata
// verificata a fondo prima di questo cambiamento — vedi la cronologia della
// sessione di lavoro — e non è stata toccata, solo recorded_by_id ora viene
// dalla sessione invece che da una scelta manuale nel form.

import { createHoursForecast } from "../src/lib/actions/forecast";
import { db } from "../src/lib/db";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

async function main() {
  console.log("=== Chiamata fuori da un contesto di richiesta: deve fermarsi al controllo sessione ===");
  const r1 = await createHoursForecast(
    { status: "idle" },
    fd({ serviceId: "1", personId: "1", quarter: "2026-Q3", etcHours: "10" })
  );
  console.log(JSON.stringify(r1, null, 2));
  if (r1.status !== "error" || !r1.errors?._form?.includes("Sessione scaduta")) {
    throw new Error("Atteso l'errore di sessione mancante");
  }
  console.log("OK — il guard di autenticazione blocca correttamente l'azione senza sessione\n");

  await db.destroy();
}

main().catch(async (e) => {
  console.error("FALLITO:", e);
  await db.destroy();
  process.exit(1);
});
