// Parser CSV minimale (RFC4180-ish): campi tra virgolette, virgolette
// interne raddoppiate, delimitatore auto-rilevato. L'Excel in italiano
// esporta spesso con ";" (la "," è già il separatore decimale) — per
// questo l'auto-rilevamento conta entrambi sulla riga di intestazione
// invece di assumere sempre la virgola.

export function detectDelimiter(headerLine: string): "," | ";" {
  const commaCount = (headerLine.match(/,/g) ?? []).length;
  const semicolonCount = (headerLine.match(/;/g) ?? []).length;
  return semicolonCount > commaCount ? ";" : ",";
}

export function parseCsv(text: string, delimiter?: string): string[][] {
  const delim = delimiter ?? detectDelimiter(text.split(/\r?\n/, 1)[0] ?? "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field.trim());
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      pushField();
    } else if (c === "\n") {
      if (field !== "" || row.length > 0) pushRow();
    } else if (c === "\r") {
      // ignorato — il fine riga è gestito da \n
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) pushRow();

  // scarta righe totalmente vuote (es. riga finale del file)
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}
