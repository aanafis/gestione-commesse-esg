import { db } from "@/lib/db";

/**
 * Una riga per ogni coppia (servizio, persona) assegnata su un servizio non
 * chiuso — l'ETC ha senso solo dove esiste già un'assegnazione. Include
 * stimate/consuntivo (per il suggerimento MAX(0, stimate-consuntivo) da
 * mostrare accanto al campo, mai da precompilare — §3) e, se esiste, la
 * previsione corrente per dare contesto.
 */
export async function getAssignmentPairsForForecast() {
  const pairs = await db
    .selectFrom("assignment as a")
    .innerJoin("service as s", "s.id", "a.serviceId")
    .innerJoin("commessa as c", "c.id", "s.commessaId")
    .innerJoin("person as p", "p.id", "a.personId")
    .leftJoin("vAssignmentMetrics as am", (join) =>
      join.onRef("am.serviceId", "=", "a.serviceId").onRef("am.personId", "=", "a.personId")
    )
    .select([
      "a.serviceId",
      "a.personId",
      "s.code as serviceCode",
      "c.code as commessaCode",
      "p.name as personName",
      "a.estimatedHours",
      "am.actualHours",
    ])
    .where("s.status", "!=", "closed")
    .orderBy("s.code")
    .orderBy("p.name")
    .execute();

  const current = await db
    .selectFrom("hoursForecast")
    .select(["serviceId", "personId", "etcHours", "quarter", "recordedAt"])
    .where("isCurrent", "=", true)
    .execute();
  const currentByPair = new Map(current.map((c) => [`${c.serviceId}:${c.personId}`, c]));

  return pairs.map((p) => ({
    ...p,
    current: currentByPair.get(`${p.serviceId}:${p.personId}`) ?? null,
  }));
}

/** Trimestre corrente + i successivi/precedenti, come "YYYY-Qn". */
export function nearbyQuarters(reference: Date, offsets: number[]): string[] {
  const year = reference.getUTCFullYear();
  const quarter = Math.floor(reference.getUTCMonth() / 3) + 1;
  const absoluteQuarter = year * 4 + (quarter - 1);
  return offsets.map((offset) => {
    const abs = absoluteQuarter + offset;
    const y = Math.floor(abs / 4);
    const q = (abs % 4) + 1;
    return `${y}-Q${q}`;
  });
}
