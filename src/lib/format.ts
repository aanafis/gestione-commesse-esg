// Kysely restituisce i NUMERIC di Postgres come stringa (per non perdere
// precisione in JS). Questi helper li convertono e formattano in it-IT.

type Num = string | number | null | undefined;

export function toNumber(v: Num): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

const moneyFmt = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const hoursFmt = new Intl.NumberFormat("it-IT", {
  maximumFractionDigits: 1,
});

const pctFmt = new Intl.NumberFormat("it-IT", {
  style: "percent",
  maximumFractionDigits: 1,
});

/** "€ 12.345" — nessun decimale, coerente con l'uso del cruscotto. */
export function formatMoney(v: Num): string {
  const n = toNumber(v);
  return n === null ? "–" : moneyFmt.format(n);
}

/** "123,4 h" */
export function formatHours(v: Num): string {
  const n = toNumber(v);
  return n === null ? "–" : `${hoursFmt.format(n)} h`;
}

/** Riceve una frazione decimale (0.30 = 30%) e restituisce "30,0%". */
export function formatPercent(v: Num): string {
  const n = toNumber(v);
  return n === null ? "–" : pctFmt.format(n);
}

export function formatNumber(v: Num): string {
  const n = toNumber(v);
  return n === null ? "–" : new Intl.NumberFormat("it-IT").format(n);
}

export function formatMultiplier(v: Num): string {
  const n = toNumber(v);
  return n === null ? "–" : `${hoursFmt.format(n)}x`;
}

// timeZone: "UTC" esplicito su entrambi i formattatori qui sotto: sono date
// di calendario senza componente oraria (vedi db/index.ts), quindi vanno
// lette nel fuso in cui sono ancorate (UTC) e mai reinterpretate nel fuso
// locale di chi le visualizza — altrimenti la data mostrata può scivolare
// di un giorno a seconda del fuso del browser/server.
const dateFmt = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** Accetta Date, stringa ISO, o null. Kysely restituisce le DATE come Date. */
export function formatDate(v: Date | string | null | undefined): string {
  if (!v) return "–";
  const d = typeof v === "string" ? new Date(v) : v;
  return Number.isNaN(d.getTime()) ? "–" : dateFmt.format(d);
}

/** Numero "grezzo" per l'export CSV (§6.2) — virgola decimale (Excel IT),
 * niente simbolo di valuta né separatore delle migliaia come formatMoney,
 * così Excel lo riconosce come numero e ci si può fare una tabella pivot.
 * Riparte dalla stringa originale del NUMERIC, non da toNumber()+toString():
 * evita di reintrodurre imprecisioni in virgola mobile su un valore che
 * arriva già come decimale esatto dal database. */
export function csvNumber(v: Num): string {
  if (v === null || v === undefined) return "";
  return String(v).replace(".", ",");
}

/** Frazione decimale (0.305) in punti percentuali per il CSV ("30,50"),
 * coerente con come si leggono normalmente ("margine al 30%") — a
 * differenza della cella grezza, qui moltiplichiamo per 100. */
export function csvPercent(v: Num): string {
  const n = toNumber(v);
  return n === null ? "" : (n * 100).toFixed(2).replace(".", ",");
}

/**
 * Converte una DATE del database nel formato "YYYY-MM-DD" richiesto dal
 * value di <input type="date">. Stessa regola delle altre funzioni qui
 * sopra: metodi getUTC*, mai quelli locali — altrimenti il valore mostrato
 * nel form può scivolare di un giorno a seconda del fuso del browser.
 */
export function toDateInputValue(v: Date | string | null | undefined): string {
  if (!v) return "";
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const monthLabelFmt = new Intl.DateTimeFormat("it-IT", { month: "short", timeZone: "UTC" });

/** "2026-07" → "lug 26" */
export function formatMonthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(year, m - 1, 1));
  return `${monthLabelFmt.format(d)} ${String(year).slice(2)}`;
}

