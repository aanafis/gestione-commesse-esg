import { db } from "@/lib/db";

/**
 * Una riga per commessa, con il prossimo codice servizio suggerito
 * ({commessa.code}-{lettera libera}, §4.2) — calcolato qui una volta sola
 * così il form può aggiornare il suggerimento lato client senza altre
 * richieste al server quando l'utente cambia commessa.
 */
export async function getCommesseForServiceForm() {
  const [commesse, services] = await Promise.all([
    db.selectFrom("commessa").select(["id", "code"]).orderBy("code", "desc").execute(),
    db.selectFrom("service").select(["commessaId", "code"]).execute(),
  ]);

  const usedLetters = new Map<string, Set<string>>();
  for (const s of services) {
    const letter = s.code.slice(-1);
    if (!usedLetters.has(s.commessaId)) usedLetters.set(s.commessaId, new Set());
    usedLetters.get(s.commessaId)!.add(letter);
  }

  return commesse.map((c) => {
    const used = usedLetters.get(c.id) ?? new Set<string>();
    let letter = "A";
    for (let i = 0; i < 26; i++) {
      const candidate = String.fromCharCode(65 + i);
      if (!used.has(candidate)) {
        letter = candidate;
        break;
      }
    }
    return { id: c.id, code: c.code, nextServiceCode: `${c.code}-${letter}` };
  });
}

export function getServiceTypesForSelect() {
  return db
    .selectFrom("serviceType")
    .select(["id", "name"])
    .where("active", "=", true)
    .orderBy("sortOrder")
    .execute();
}

export async function getPhaseTemplateNames(): Promise<string[]> {
  const rows = await db
    .selectFrom("phaseTemplate")
    .select("templateName")
    .distinct()
    .orderBy("templateName")
    .execute();
  return rows.map((r) => r.templateName);
}

export function getActivePeopleForSelect() {
  return db
    .selectFrom("person")
    .select(["id", "name"])
    .where("active", "=", true)
    .orderBy("name")
    .execute();
}

export async function getDefaultMarkup(): Promise<string> {
  const settings = await db.selectFrom("settings").select("defaultMarkup").executeTakeFirst();
  return settings?.defaultMarkup ?? "1.30";
}

/**
 * Valori grezzi del servizio per precompilare la maschera di modifica.
 * Commessa e codice non sono qui: sono l'identità del servizio, non si
 * modificano da questa maschera (vedi ServiceEditForm).
 */
export function getServiceForEdit(id: string) {
  return db
    .selectFrom("service as s")
    .innerJoin("commessa as c", "c.id", "s.commessaId")
    .select([
      "s.id",
      "s.code",
      "c.code as commessaCode",
      "s.serviceTypeId",
      "s.variant",
      "s.pmId",
      "s.startDate",
      "s.endDate",
      "s.status",
      "s.consultantCostBudget",
      "s.markup",
      "s.contractedPrice",
    ])
    .where("s.id", "=", id)
    .executeTakeFirst();
}
