import { db } from "@/lib/db";

export function getSuppliersForSelect() {
  return db
    .selectFrom("supplier")
    .select(["id", "code", "name"])
    .orderBy("name")
    .execute();
}

export function getServicesForPurchaseOrderForm() {
  return db
    .selectFrom("service as s")
    .innerJoin("commessa as c", "c.id", "s.commessaId")
    .select(["s.id", "s.code", "c.code as commessaCode"])
    .where("s.status", "!=", "closed")
    .orderBy("s.code")
    .execute();
}

export function getApproversForSelect() {
  return db
    .selectFrom("person")
    .select(["id", "name"])
    .where("active", "=", true)
    .orderBy("name")
    .execute();
}

export async function getApprovalThresholds(): Promise<{ pm: string; director: string }> {
  const s = await db
    .selectFrom("settings")
    .select(["pmApprovalThreshold", "directorApprovalThreshold"])
    .executeTakeFirst();
  return { pm: s?.pmApprovalThreshold ?? "5000", director: s?.directorApprovalThreshold ?? "15000" };
}
