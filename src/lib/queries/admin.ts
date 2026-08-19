import { db } from "@/lib/db";

// Query per le pagine Admin (§6.6). Nessun filtro "attivo/non chiuso" qui —
// a differenza delle schermate operative, l'Admin deve vedere tutto,
// incluso ciò che è stato disattivato, per poterlo eventualmente riattivare.

export function getAllLevels() {
  return db.selectFrom("level").selectAll().orderBy("internalCostRate", "desc").execute();
}

export function getLevel(id: string) {
  return db.selectFrom("level").selectAll().where("id", "=", id).executeTakeFirst();
}

export function getAllServiceTypes() {
  return db.selectFrom("serviceType").selectAll().orderBy("sortOrder").execute();
}

export function getServiceType(id: string) {
  return db.selectFrom("serviceType").selectAll().where("id", "=", id).executeTakeFirst();
}

export function getAllPeople() {
  return db
    .selectFrom("person as p")
    .innerJoin("level as l", "l.id", "p.levelId")
    .select(["p.id", "p.name", "p.email", "p.active", "p.role", "p.annualAvailableHours", "l.name as levelName", "p.levelId"])
    .orderBy("p.name")
    .execute();
}

export function getPerson(id: string) {
  return db.selectFrom("person").selectAll().where("id", "=", id).executeTakeFirst();
}

export function getAllClients() {
  return db.selectFrom("client").selectAll().orderBy("name").execute();
}

export function getClient(id: string) {
  return db.selectFrom("client").selectAll().where("id", "=", id).executeTakeFirst();
}

export function getAllSuppliers() {
  return db.selectFrom("supplier").selectAll().orderBy("name").execute();
}

export function getSupplier(id: string) {
  return db.selectFrom("supplier").selectAll().where("id", "=", id).executeTakeFirst();
}

export async function getPhaseTemplatesSummary() {
  const rows = await db
    .selectFrom("phaseTemplate")
    .select(["templateName"])
    .select((eb) => eb.fn.sum<string>("hoursQuotaPct").as("totalQuota"))
    .select((eb) => eb.fn.countAll<string>().as("phaseCount"))
    .groupBy("templateName")
    .orderBy("templateName")
    .execute();
  return rows;
}

export function getPhaseTemplateRows(templateName: string) {
  return db
    .selectFrom("phaseTemplate")
    .selectAll()
    .where("templateName", "=", templateName)
    .orderBy("sortOrder")
    .execute();
}

export function getPhaseTemplateRow(id: string) {
  return db.selectFrom("phaseTemplate").selectAll().where("id", "=", id).executeTakeFirst();
}

export function getSettingsRow() {
  return db.selectFrom("settings").selectAll().where("id", "=", 1).executeTakeFirstOrThrow();
}
