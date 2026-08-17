import { Pool, types } from "pg";
import { CamelCasePlugin, Kysely, PostgresDialect } from "kysely";
import type { DB } from "./types";

// Bug reale scoperto in fase di test (scripts/test-service-action.ts): il
// parser di default di node-pg per il tipo DATE (oid 1082) costruisce un
// Date object a mezzanotte nel fuso orario LOCALE del processo, non UTC.
// Con un fuso diverso da UTC (qui CET), un valore memorizzato come
// '2026-01-11' torna come 2026-01-10T23:00:00Z non appena lo si serializza
// in UTC (es. .toISOString()) — la data "scivola" indietro di un giorno.
// Le colonne DATE del nostro schema non hanno componente oraria/fuso: le
// ancoriamo sempre alla mezzanotte UTC, qui una volta sola per l'intero
// processo, invece di doverci pensare in ogni punto che legge una data.
types.setTypeParser(1082, (value: string) => {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
});

// Un solo Pool condiviso per tutta l'app (Server Components + route handler).
// Next.js in sviluppo può ricaricare questo modulo più volte: lo teniamo su
// globalThis per non aprire un nuovo pool di connessioni ad ogni hot-reload.
declare global {
  // eslint-disable-next-line no-var
  var __db: Kysely<DB> | undefined;
}

function createDb(): Kysely<DB> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL non impostata (vedi .env.local).");
  }

  return new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString }),
    }),
    // Le tabelle/colonne in Postgres sono snake_case; il codice TypeScript
    // (e i tipi generati da kysely-codegen --camel-case) usa camelCase.
    // Questo plugin traduce nei due sensi ad ogni query.
    plugins: [new CamelCasePlugin()],
  });
}

export const db = globalThis.__db ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalThis.__db = db;
}
