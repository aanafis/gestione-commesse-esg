import { db } from "@/lib/db";

export function getClientsForSelect() {
  return db
    .selectFrom("client")
    .select(["id", "name"])
    .orderBy("name")
    .execute();
}

/**
 * Codice suggerito come punto di partenza (AA-NNN, §4.2): anno corrente a 2
 * cifre + progressivo successivo all'ultimo usato per quell'anno. Resta un
 * suggerimento — l'utente può sovrascriverlo (es. per inserire la commessa
 * pilota 26-017 già presente nel file Excel).
 */
export async function suggestNextCommessaCode(): Promise<string> {
  const yearPrefix = String(new Date().getFullYear() % 100).padStart(2, "0");
  const rows = await db
    .selectFrom("commessa")
    .select("code")
    .where("code", "like", `${yearPrefix}-%`)
    .orderBy("code", "desc")
    .limit(1)
    .execute();

  const last = rows[0]?.code;
  const lastNum = last ? parseInt(last.slice(3), 10) : 0;
  const nextNum = Number.isFinite(lastNum) ? lastNum + 1 : 1;
  return `${yearPrefix}-${String(nextNum).padStart(3, "0")}`;
}

/** Valori grezzi per precompilare la maschera di modifica. Il codice non è
 * qui: è l'identità della commessa, non si modifica da questa maschera
 * (stessa scelta già fatta per il servizio). */
export function getCommessaForEdit(id: string) {
  return db
    .selectFrom("commessa")
    .select([
      "id",
      "code",
      "clientId",
      "assetName",
      "clientContact",
      "startDate",
      "endDate",
      "status",
      "contractValue",
    ])
    .where("id", "=", id)
    .executeTakeFirst();
}
