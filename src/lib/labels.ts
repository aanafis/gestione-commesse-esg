// Traduzione degli enum (identificatori in inglese nel database, §0 della
// spec) in etichette italiane per l'interfaccia.

export const PERSON_ROLE_LABELS: Record<string, string> = {
  admin: "Amministratore",
  member: "Membro",
};

export const SERVICE_STATUS_LABELS: Record<string, string> = {
  active: "Attivo",
  suspended: "Sospeso",
  in_certification: "In certificazione",
  closed: "Chiuso",
};

export const COMMESSA_STATUS_LABELS: Record<string, string> = {
  offer: "Offerta",
  active: "Attiva",
  suspended: "Sospesa",
  closed: "Chiusa",
  lost: "Persa",
};

export const PHASE_STATUS_LABELS: Record<string, string> = {
  not_started: "Da iniziare",
  in_progress: "In corso",
  completed: "Completata",
  overdue: "In ritardo",
};

export const PROJECT_ROLE_LABELS: Record<string, string> = {
  project_manager: "Project manager",
  supervision: "Supervisione",
  documentation: "Documentazione",
  site_inspections: "Sopralluoghi",
  data_analysis: "Analisi dati",
  support: "Supporto",
};

export const MILESTONE_TYPE_LABELS: Record<string, string> = {
  advance: "Acconto",
  interim: "SAL intermedio",
  balance: "Saldo",
  extra: "Extra",
};

export const MILESTONE_BASIS_LABELS: Record<string, string> = {
  percentage: "Percentuale",
  fixed: "Importo fisso",
};

export const COLLECTION_STATUS_LABELS: Record<string, string> = {
  to_issue: "Da emettere",
  issued: "Emesso",
  collected: "Incassato",
  overdue: "Scaduto",
  disputed: "Contestato",
};

export const PO_STATUS_LABELS: Record<string, string> = {
  requested: "Richiesto",
  approved: "Approvato",
  issued: "Emesso",
  delivered: "Consegnato",
  invoiced: "Fatturato",
  paid: "Pagato",
  cancelled: "Annullato",
};

export const APPROVAL_LEVEL_LABELS: Record<string, string> = {
  autonomous: "Autonoma",
  project_manager: "Project manager",
  director: "Direttore",
};

export const SUPPLIER_CATEGORY_LABELS: Record<string, string> = {
  commissioning_agent: "Commissioning agent",
  testing_laboratory: "Laboratorio prove",
  energy_modeler: "Energy modeler",
  acoustics: "Acustica",
  lighting: "Illuminotecnica",
  iaq_survey: "Indagini IAQ",
  water_analysis: "Analisi acqua",
  accessibility_surveyor: "Surveyor accessibilità",
  external_technical_consultant: "Consulente tecnico esterno",
  esg_certification_body: "Certificazioni ESG",
  other: "Altro",
};

export const TIME_ENTRY_SOURCE_LABELS: Record<string, string> = {
  import: "Import",
  manual: "Manuale",
};

export function label(dict: Record<string, string>, value: string | null): string {
  if (value === null) return "–";
  return dict[value] ?? value;
}
