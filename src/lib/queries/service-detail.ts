import { db } from "@/lib/db";

// Scheda servizio — SPEC.md §6.3. Ogni funzione legge una vista o una
// tabella già pronta; nessun calcolo qui.
//
// id come stringa: le colonne bigint di Postgres arrivano dal driver come
// stringa (per non perdere precisione in JS), coerente con come Kysely le
// tipizza qui.

export function getServiceHeader(id: string) {
  return db
    .selectFrom("service as s")
    .innerJoin("commessa as c", "c.id", "s.commessaId")
    .innerJoin("client as cl", "cl.id", "c.clientId")
    .innerJoin("serviceType as st", "st.id", "s.serviceTypeId")
    .leftJoin("person as pm", "pm.id", "s.pmId")
    .select([
      "s.id",
      "s.code",
      "s.status",
      "s.startDate",
      "s.endDate",
      "s.variant",
      "c.id as commessaId",
      "c.code as commessaCode",
      "cl.name as clientName",
      "c.assetName",
      "st.name as serviceTypeName",
      "pm.name as pmName",
    ])
    .where("s.id", "=", id)
    .executeTakeFirst();
}

export function getServiceMetrics(id: string) {
  return db
    .selectFrom("vServiceMetrics")
    .selectAll()
    .where("serviceId", "=", id)
    .executeTakeFirst();
}

export function getServiceAlert(id: string) {
  return db
    .selectFrom("vServiceAlert")
    .selectAll()
    .where("serviceId", "=", id)
    .executeTakeFirst();
}

export function getPhases(id: string) {
  return db
    .selectFrom("vPhaseStatus")
    .selectAll()
    .where("serviceId", "=", id)
    .orderBy("sortOrder")
    .execute();
}

export function getMilestones(id: string) {
  return db
    .selectFrom("vBillingMilestoneStatus as m")
    .leftJoin("phase as p", "p.id", "m.triggerPhaseId")
    .select([
      "m.milestoneId",
      "m.type",
      "m.description",
      "m.basis",
      "m.percentage",
      "m.fixedAmount",
      "m.amount",
      "m.isIssuable",
      "m.plannedIssueDate",
      "m.issueDate",
      "m.invoiceNumber",
      "m.collectionStatus",
      "m.collectionDate",
      "p.name as triggerPhaseName",
    ])
    .where("m.serviceId", "=", id)
    .orderBy("m.plannedIssueDate")
    .execute();
}

export function getAssignments(id: string) {
  return db
    .selectFrom("vAssignmentMetrics as a")
    .innerJoin("person as p", "p.id", "a.personId")
    .select([
      "a.assignmentId",
      "p.name as personName",
      "a.projectRole",
      "a.estimatedHours",
      "a.actualHours",
      "a.etcHours",
      "a.eacHours",
      "a.variance",
      "a.consumedPct",
      "a.alert",
      "a.hoursPrice",
      "a.hoursCost",
      "a.estimatedMargin",
      "a.eacCost",
      "a.eacValue",
    ])
    .where("a.serviceId", "=", id)
    .orderBy("p.name")
    .execute();
}

export function getPurchaseOrderLines(id: string) {
  return db
    .selectFrom("vPurchaseOrderLineMetrics as l")
    .innerJoin("purchaseOrder as po", "po.id", "l.purchaseOrderId")
    .innerJoin("supplier as s", "s.id", "po.supplierId")
    .select([
      "l.lineId",
      "po.number",
      "s.name as supplierName",
      "po.status as poStatus",
      "l.phaseRef",
      "l.consultantCost",
      "l.rechargedToClient",
      "l.invoicedAmount",
      "l.markupApplied",
      "l.lineMargin",
      "l.isCommitted",
    ])
    .where("l.serviceId", "=", id)
    .orderBy("po.number")
    .execute();
}

export function getTimeEntries(id: string) {
  return db
    .selectFrom("timeEntry as t")
    .innerJoin("person as p", "p.id", "t.personId")
    .leftJoin("phase as ph", "ph.id", "t.phaseId")
    .select(["t.id", "t.month", "p.name as personName", "ph.name as phaseName", "t.hours", "t.source"])
    .where("t.serviceId", "=", id)
    .orderBy("t.month", "desc")
    .execute();
}

export function getForecasts(id: string) {
  return db
    .selectFrom("hoursForecast as f")
    .innerJoin("person as p", "p.id", "f.personId")
    .select([
      "f.id",
      "f.quarter",
      "p.name as personName",
      "f.etcHours",
      "f.isCurrent",
      "f.recordedAt",
      "f.notes",
    ])
    .where("f.serviceId", "=", id)
    .orderBy("f.recordedAt", "desc")
    .execute();
}
