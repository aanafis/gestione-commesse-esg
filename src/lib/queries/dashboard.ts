import { db } from "@/lib/db";

// Ogni funzione legge da una vista già pronta (db/migrations/0007_views_dashboard.sql
// e dintorni) — nessuna logica di calcolo qui, solo lettura. Le formule vivono
// tutte nel database, come da §5 della spec ("Do not duplicate the logic in
// the frontend").

export function getPortfolio() {
  return db.selectFrom("vDashboardPortfolio").selectAll().executeTakeFirstOrThrow();
}

export function getBilling() {
  return db.selectFrom("vDashboardBilling").selectAll().executeTakeFirstOrThrow();
}

export function getProgress() {
  return db.selectFrom("vDashboardProgress").selectAll().executeTakeFirstOrThrow();
}

export function getByServiceType() {
  return db
    .selectFrom("vDashboardByServiceType")
    .selectAll()
    .orderBy("totalContractedPrice", "desc")
    .execute();
}

export function getTeamUtilisation() {
  return db
    .selectFrom("vPersonUtilisation")
    .selectAll()
    .orderBy("name")
    .execute();
}

// Stesso ordine di priorità del §5 (1 = più urgente). Usato per ordinare la
// lista qui sotto — un ORDER BY alfabetico sull'alert darebbe un ordine senza
// senso rispetto a "mostra la causa, non il sintomo".
const ALERT_PRIORITY = [
  "RISORSE NON ASSEGNATE",
  "MARGINE CRITICO",
  "SCONTO OLTRE SOGLIA",
  "ORE OLTRE LA STIMA",
  "CONSUMO ORE ELEVATO",
  "SAL DA EMETTERE",
  "FASI IN RITARDO",
];

/** Servizi attivi con l'alert più severo, per la lista "da guardare" del Cruscotto. */
export async function getActiveServiceAlerts() {
  const rows = await db
    .selectFrom("vServiceMetrics as sm")
    .innerJoin("vServiceAlert as sa", "sa.serviceId", "sm.serviceId")
    .innerJoin("service as s", "s.id", "sm.serviceId")
    .innerJoin("commessa as c", "c.id", "sm.commessaId")
    .innerJoin("client as cl", "cl.id", "c.clientId")
    .innerJoin("serviceType as st", "st.id", "sm.serviceTypeId")
    .select([
      "sm.serviceId",
      "s.code",
      "c.code as commessaCode",
      "cl.name as clientName",
      "c.assetName",
      "st.name as serviceTypeName",
      "sa.alert",
      "sm.marginPct",
      "sm.discountPct",
    ])
    .where("sm.status", "=", "active")
    .where("sa.alert", "!=", "OK")
    .execute();

  // sa.alert è un'espressione CASE: Postgres non può garantire in fase di
  // introspezione che il ramo ELSE la renda sempre non-null, quindi Kysely
  // la tipizza "string | null" — qui sappiamo che non lo è mai davvero.
  return rows.sort(
    (a, b) =>
      ALERT_PRIORITY.indexOf(a.alert ?? "") - ALERT_PRIORITY.indexOf(b.alert ?? "")
  );
}
