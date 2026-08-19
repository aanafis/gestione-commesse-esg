import "leaflet/dist/leaflet.css";
import { ProjectsMap } from "@/components/ProjectsMap";
import { getCommesseWithLocation } from "@/lib/queries/commessa-list";

// Mappa di tutti i progetti ESG (richiesta dall'utente) — un pin per
// commessa con coordinate note (indirizzo geocodificato con successo,
// vedi src/lib/geocode.ts). Import di leaflet.css qui e non nel layout
// globale: serve solo su questa pagina.
export const dynamic = "force-dynamic";

export default async function MappaPage() {
  const commesse = await getCommesseWithLocation();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-primary">Mappa progetti</h1>
        <p className="text-sm text-ink-secondary">
          {commesse.length} commess{commesse.length === 1 ? "a" : "e"} con indirizzo geocodificato. Aggiungi un
          indirizzo dalla{" "}
          <a href="/commesse" className="text-accent hover:underline">
            maschera di modifica commessa
          </a>{" "}
          per farla comparire qui.
        </p>
      </div>

      {commesse.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-ink-secondary">
          Nessuna commessa ha ancora un indirizzo geocodificato.
        </p>
      ) : (
        <ProjectsMap commesse={commesse} />
      )}
    </div>
  );
}
