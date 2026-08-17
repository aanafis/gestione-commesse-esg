import { db } from "@/lib/db";

// Controllo ore — SPEC.md §6.4. "Chiuso" escluso ovunque: un servizio chiuso
// non ha più bisogno di controllo ore corrente (a differenza del Cruscotto,
// qui includiamo anche sospesi e in certificazione, non solo attivi, perché
// lo scopo è verificare lo stato reale, non solo il portfolio corrente).

export function getServicesHoursControl() {
  return db
    .selectFrom("vServiceMetrics as sm")
    .innerJoin("service as s", "s.id", "sm.serviceId")
    .innerJoin("commessa as c", "c.id", "sm.commessaId")
    .select([
      "sm.serviceId",
      "s.code",
      "c.code as commessaCode",
      "sm.status",
      "sm.estimatedHours",
      "sm.actualHours",
      "sm.hoursConsumedPct",
      "sm.phaseProgressPct",
      "sm.hoursProgressGap",
      "sm.etcHours",
      "sm.eacHours",
      "sm.hoursVariance",
      "sm.hoursMargin",
    ])
    .where("sm.status", "!=", "closed")
    .orderBy("sm.hoursVariance", "desc")
    .execute();
}

export function getAssignmentsHoursControl() {
  return db
    .selectFrom("vAssignmentMetrics as a")
    .innerJoin("person as p", "p.id", "a.personId")
    .innerJoin("service as s", "s.id", "a.serviceId")
    .innerJoin("commessa as c", "c.id", "s.commessaId")
    .select([
      "a.assignmentId",
      "p.name as personName",
      "s.code as serviceCode",
      "c.code as commessaCode",
      "a.estimatedHours",
      "a.actualHours",
      "a.etcHours",
      "a.eacHours",
      "a.variance",
      "a.consumedPct",
      "a.alert",
    ])
    .where("s.status", "!=", "closed")
    .orderBy("a.variance", "desc")
    .execute();
}

/** Ultimi 12 mesi (incluso il corrente), 'YYYY-MM', dal più vecchio al più recente. */
export function last12Months(reference: Date): string[] {
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() - i, 1));
    months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

export function getMonthlyHoursByPerson(months: string[]) {
  return db
    .selectFrom("vMonthlyHoursByPerson as m")
    .innerJoin("person as p", "p.id", "m.personId")
    .select(["m.personId", "p.name as personName", "m.month", "m.hours"])
    .where("m.month", "in", months)
    .where("p.active", "=", true)
    .execute();
}

export function getActivePeople() {
  return db
    .selectFrom("person")
    .select(["id", "name", "annualAvailableHours"])
    .where("active", "=", true)
    .orderBy("name")
    .execute();
}
