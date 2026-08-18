import { db } from "@/lib/db";

// Maschera "Registra ore" (§4.2 TimeEntry) — inserimento manuale di una
// singola riga, per correggere o integrare senza rifare l'import CSV
// (src/lib/actions/time-entry-import.ts, che resta il percorso principale
// per un mese intero dal timesheet).

export function getServicesForTimeEntryForm() {
  return db
    .selectFrom("vServiceMetrics as sm")
    .innerJoin("service as s", "s.id", "sm.serviceId")
    .innerJoin("commessa as c", "c.id", "sm.commessaId")
    .select(["s.id", "s.code", "c.code as commessaCode"])
    .where("sm.status", "!=", "closed")
    .orderBy("s.code")
    .execute();
}

export function getPeopleForTimeEntryForm() {
  return db.selectFrom("person").select(["id", "name"]).where("active", "=", true).orderBy("name").execute();
}

/** Una riga per fase di ogni servizio non chiuso — il form filtra lato
 * client in base al servizio scelto, stesso pattern di PhaseProgressForm. */
export function getPhasesForTimeEntryForm() {
  return db
    .selectFrom("phase as p")
    .innerJoin("service as s", "s.id", "p.serviceId")
    .select(["p.id as phaseId", "p.serviceId", "p.name"])
    .where("s.status", "!=", "closed")
    .orderBy("p.sortOrder")
    .execute();
}
