import { db } from "@/lib/db";

/**
 * Fasi di tutti i servizi non chiusi, con lo stato già calcolato
 * (v_phase_status) per dare contesto nel form — nessun calcolo qui.
 */
export function getPhasesForProgressForm() {
  // id/serviceId dalla tabella phase (chiavi vere, non nullable) — status,
  // daysLate ecc. dalla vista (colonne calcolate, tipizzate nullable da
  // Postgres per come introspeziona le viste, anche se non lo sono mai qui).
  return db
    .selectFrom("phase as p")
    .innerJoin("vPhaseStatus as ph", "ph.phaseId", "p.id")
    .innerJoin("service as s", "s.id", "p.serviceId")
    .innerJoin("commessa as c", "c.id", "s.commessaId")
    .select([
      "p.id as phaseId",
      "p.serviceId",
      "s.code as serviceCode",
      "c.code as commessaCode",
      "p.name",
      "ph.status",
      "ph.daysLate",
      "p.baselineDate",
      "p.baselineConfirmed",
      "p.plannedDate",
      "p.actualDate",
      "p.progressPct",
      "p.ownerId",
      "p.contractualMilestone",
    ])
    .where("s.status", "!=", "closed")
    .orderBy("s.code")
    .orderBy("p.sortOrder")
    .execute();
}
