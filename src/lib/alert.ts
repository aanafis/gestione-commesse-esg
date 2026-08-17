// Mappa l'alert testuale prodotto da v_service_alert / v_assignment_metrics
// (§5 della spec) sulla palette di stato (good/warning/serious/critical).
// Un solo posto per questa mappatura: viene riusata ovunque compaia un alert.

export type Severity = "good" | "warning" | "serious" | "critical";

const SEVERITY_BY_ALERT: Record<string, Severity> = {
  "OK": "good",
  "RISORSE NON ASSEGNATE": "critical",
  "MARGINE CRITICO": "critical",
  "SCONTO OLTRE SOGLIA": "serious",
  "ORE OLTRE LA STIMA": "serious",
  "CONSUMO ORE ELEVATO": "warning",
  "SAL DA EMETTERE": "warning",
  "FASI IN RITARDO": "warning",
  // alert a livello di singola assegnazione (§5, "Per-assignment alert")
  "SFORAMENTO OLTRE 15%": "critical",
  "SOPRA LA STIMA": "serious",
  "CONSUMO ELEVATO": "warning",
};

export function severityOf(alert: string): Severity {
  return SEVERITY_BY_ALERT[alert] ?? "warning";
}
