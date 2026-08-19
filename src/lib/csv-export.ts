// Export CSV lato client (tabelle Servizi/Commesse, §6.2) — punto e virgola
// come separatore: la virgola è già il separatore decimale nel CSV italiano
// di Excel, un CSV a virgole spezzerebbe ogni colonna numerica.

function escapeCsvField(v: string): string {
  if (/[;"\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function rowsToCsv(headers: string[], rows: string[][]): string {
  const lines = [headers.map(escapeCsvField).join(";"), ...rows.map((r) => r.map(escapeCsvField).join(";"))];
  // BOM iniziale (String.fromCharCode invece del carattere letterale, per
  // non affidarsi alla codifica con cui questo file viene salvato/letto):
  // senza, Excel prova a indovinare la codifica e spesso sbaglia sui
  // caratteri accentati (è, à...) nei nomi.
  return String.fromCharCode(0xfeff) + lines.join("\r\n");
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
