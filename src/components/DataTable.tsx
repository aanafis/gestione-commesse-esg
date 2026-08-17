export type Column<T> = {
  key: string;
  label: string;
  align?: "left" | "right";
  render?: (row: T) => React.ReactNode;
};

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  emptyLabel,
}: {
  columns: Column<T>[];
  rows: T[];
  // Le colonne id delle viste sono spesso tipizzate "string | null" perché
  // Postgres non garantisce la non-nullabilità delle colonne calcolate in
  // fase di introspezione, anche quando in pratica non lo sono mai. Da qui
  // il fallback sull'indice riga.
  getRowKey: (row: T) => string | number | null | undefined;
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-ink-muted">
        {emptyLabel ?? "Nessun dato."}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gridline text-left text-ink-secondary">
            {columns.map((c) => (
              <th
                key={c.key}
                className={`px-4 py-2 font-medium whitespace-nowrap ${
                  c.align === "right" ? "text-right" : ""
                }`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[font-variant-numeric:tabular-nums]">
          {rows.map((row, i) => (
            <tr key={getRowKey(row) ?? i} className="border-b border-gridline last:border-0">
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`px-4 py-2 whitespace-nowrap ${
                    c.align === "right" ? "text-right text-ink-secondary" : "text-ink-primary"
                  }`}
                >
                  {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "–")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
