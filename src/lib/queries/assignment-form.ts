import { db } from "@/lib/db";

/**
 * Una riga per servizio non chiuso, coi numeri già pronti per il calcolo
 * live del form (§6.5: "show live... the running service price total, and
 * the gap versus the contracted price"). Niente calcoli qui — consultant
 * price e prezzo ore esistente arrivano già fatti da v_service_metrics.
 */
export async function getServicesForAssignmentForm() {
  const services = await db
    .selectFrom("vServiceMetrics as sm")
    .innerJoin("service as s", "s.id", "sm.serviceId")
    .innerJoin("commessa as c", "c.id", "sm.commessaId")
    .select([
      "s.id as serviceId",
      "s.code",
      "c.code as commessaCode",
      "sm.consultantPrice",
      "sm.hoursPrice",
      "sm.contractedPrice",
    ])
    .where("sm.status", "!=", "closed")
    .orderBy("s.code")
    .execute();

  const assignments = await db.selectFrom("assignment").select(["serviceId", "personId"]).execute();
  const assignedPeopleByService = new Map<string, string[]>();
  for (const a of assignments) {
    if (!assignedPeopleByService.has(a.serviceId)) assignedPeopleByService.set(a.serviceId, []);
    assignedPeopleByService.get(a.serviceId)!.push(a.personId);
  }

  return services.map((s) => ({
    ...s,
    assignedPersonIds: assignedPeopleByService.get(s.serviceId) ?? [],
  }));
}

/** Valori grezzi per precompilare la maschera di modifica assegnazione.
 * Persona e servizio non sono modificabili da qui — sono l'identità della
 * riga (vincolo di unicità service_id+person_id): cambiarli significherebbe
 * creare un'assegnazione diversa, non modificare questa. */
export function getAssignmentForEdit(id: string) {
  return db
    .selectFrom("assignment as a")
    .innerJoin("service as s", "s.id", "a.serviceId")
    .innerJoin("commessa as c", "c.id", "s.commessaId")
    .innerJoin("person as p", "p.id", "a.personId")
    .innerJoin("level as l", "l.id", "p.levelId")
    .select([
      "a.id",
      "a.serviceId",
      "s.code as serviceCode",
      "c.code as commessaCode",
      "p.name as personName",
      "l.name as levelName",
      "a.projectRole",
      "a.estimatedHours",
    ])
    .where("a.id", "=", id)
    .executeTakeFirst();
}

export function getPeopleWithRates() {
  return db
    .selectFrom("person as p")
    .innerJoin("level as l", "l.id", "p.levelId")
    .select(["p.id", "p.name", "l.name as levelName", "l.internalCostRate", "l.soldRate"])
    .where("p.active", "=", true)
    .orderBy("p.name")
    .execute();
}
