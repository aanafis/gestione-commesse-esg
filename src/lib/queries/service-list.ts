import { db } from "@/lib/db";

// Servizi — SPEC.md §6.2. Una riga per servizio, tutti gli stati (il filtro
// per stato lo fa l'utente in UI, non la query) — a differenza del
// Cruscotto che si limita ai soli servizi attivi.
export function getServiceList() {
  return db
    .selectFrom("vServiceMetrics as sm")
    .innerJoin("service as s", "s.id", "sm.serviceId")
    .innerJoin("commessa as c", "c.id", "sm.commessaId")
    .innerJoin("client as cl", "cl.id", "c.clientId")
    .innerJoin("serviceType as st", "st.id", "sm.serviceTypeId")
    .leftJoin("person as pm", "pm.id", "sm.pmId")
    .leftJoin("vServiceAlert as sa", "sa.serviceId", "sm.serviceId")
    .select([
      "sm.serviceId",
      "s.code",
      "c.code as commessaCode",
      "cl.name as clientName",
      "st.name as serviceTypeName",
      "s.variant",
      "pm.name as pmName",
      "sm.status",
      "sa.alert",
      "sm.marginPct",
      "sm.discountPct",
      "sm.hoursVariance",
      "sm.contractedPrice",
      "sm.estimatedHours",
      "sm.eacHours",
    ])
    .orderBy("s.code")
    .execute();
}

export type ServiceListRow = Awaited<ReturnType<typeof getServiceList>>[number];
