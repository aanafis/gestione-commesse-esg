-- 0001_init_schema.sql
-- Schema iniziale — ESG Project Management Tool
-- Rif. SPEC.md §4 (Data model) e §5 (Derived values reference).
--
-- Non contiene ancora le viste per i valori derivati (prezzi, margini, alert):
-- fanno parte dello step 2 del piano di build, non di questo step.
--
-- Decisione confermata con l'utente: le tariffe (cost_rate / sold_rate) vengono
-- "congelate" (snapshot) su Assignment e TimeEntry al momento della creazione,
-- così un cambio tariffa futuro non altera i margini già calcolati sul passato.

BEGIN;

-- ============================================================
-- ENUM
-- ============================================================

CREATE TYPE person_role AS ENUM ('admin', 'member');

CREATE TYPE commessa_status AS ENUM ('offer', 'active', 'suspended', 'closed', 'lost');

-- Set diverso da commessa_status: un Servizio non esiste ancora finché la
-- Commessa è "offer", e non ha senso "lost" a livello di singolo servizio.
CREATE TYPE service_status AS ENUM ('active', 'suspended', 'in_certification', 'closed');

CREATE TYPE project_role AS ENUM (
  'project_manager', 'supervision', 'documentation',
  'site_inspections', 'data_analysis', 'support'
);

CREATE TYPE milestone_type AS ENUM ('advance', 'interim', 'balance', 'extra');
CREATE TYPE milestone_basis AS ENUM ('percentage', 'fixed');
CREATE TYPE collection_status AS ENUM ('to_issue', 'issued', 'collected', 'overdue', 'disputed');

CREATE TYPE po_status AS ENUM (
  'requested', 'approved', 'issued', 'delivered', 'invoiced', 'paid', 'cancelled'
);

-- 11 valori: i 10 della spec + 'esg_certification_body', necessario perché
-- tutti e 4 i fornitori reali oggi in FORNITORI usano "Certificazioni ESG",
-- categoria assente nell'elenco originale della spec.
CREATE TYPE supplier_category AS ENUM (
  'commissioning_agent', 'testing_laboratory', 'energy_modeler', 'acoustics',
  'lighting', 'iaq_survey', 'water_analysis', 'accessibility_surveyor',
  'external_technical_consultant', 'esg_certification_body', 'other'
);

CREATE TYPE offer_status AS ENUM ('draft', 'sent', 'negotiating', 'won', 'lost', 'withdrawn');

CREATE TYPE time_entry_source AS ENUM ('import', 'manual');

-- ============================================================
-- Funzione di supporto per updated_at automatico
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. Dati anagrafici di riferimento
-- ============================================================

-- Person prima di Level: Level ha una FK di audit verso person (created_by),
-- e person ha una FK verso level (level_id) — dipendenza circolare.
-- Si risolve creando person con level_id "libero" e aggiungendo il vincolo
-- con ALTER TABLE dopo che level esiste.
CREATE TABLE person (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  level_id BIGINT,                          -- FK aggiunta più sotto
  annual_available_hours NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (annual_available_hours >= 0),
  active BOOLEAN NOT NULL DEFAULT true,
  role person_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT REFERENCES person(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT REFERENCES person(id)
);

CREATE TABLE level (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  internal_cost_rate NUMERIC(8,2) NOT NULL CHECK (internal_cost_rate >= 0),
  sold_rate NUMERIC(8,2) NOT NULL CHECK (sold_rate >= 0),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT REFERENCES person(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT REFERENCES person(id)
);

ALTER TABLE person
  ADD CONSTRAINT fk_person_level FOREIGN KEY (level_id) REFERENCES level(id);

CREATE INDEX idx_person_level_id ON person(level_id);

CREATE TRIGGER trg_person_updated_at BEFORE UPDATE ON person
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_level_updated_at BEFORE UPDATE ON level
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE client (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  vat_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT REFERENCES person(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT REFERENCES person(id)
);
CREATE TRIGGER trg_client_updated_at BEFORE UPDATE ON client
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE supplier (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category supplier_category NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  payment_terms TEXT,
  vat_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT REFERENCES person(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT REFERENCES person(id)
);
CREATE TRIGGER trg_supplier_updated_at BEFORE UPDATE ON supplier
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Tabella (non enum): l'utente deve poterla estendere senza una migration.
-- Decisione confermata: elenco granulare 1:1 coi template fasi
-- (es. "LEED BD+C" e "LEED ID+C" come righe distinte), non una categoria
-- generica con variante separata — rispecchia l'uso reale del file Excel.
CREATE TABLE service_type (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true
);

-- Una riga per ogni fase di ogni template. hours_quota_pct deve sommare a 1.0
-- per ciascun template_name: non è un vincolo DB rigido (bloccherebbe la
-- modifica riga per riga durante l'editing), ma un controllo applicativo
-- che mostra un avviso finché lo scostamento persiste.
CREATE TABLE phase_template (
  id BIGSERIAL PRIMARY KEY,
  template_name TEXT NOT NULL,
  sort_order INT NOT NULL,
  phase_name TEXT NOT NULL,
  expected_deliverable TEXT,
  contractual_milestone BOOLEAN NOT NULL DEFAULT false,
  duration_days INT NOT NULL CHECK (duration_days >= 0),
  hours_quota_pct NUMERIC(6,4) NOT NULL CHECK (hours_quota_pct >= 0 AND hours_quota_pct <= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT REFERENCES person(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT REFERENCES person(id),
  UNIQUE (template_name, sort_order)
);
CREATE INDEX idx_phase_template_name ON phase_template(template_name);
CREATE TRIGGER trg_phase_template_updated_at BEFORE UPDATE ON phase_template
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 2. Entità centrali
-- ============================================================

CREATE TABLE commessa (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  client_id BIGINT NOT NULL REFERENCES client(id),
  asset_name TEXT,
  client_contact TEXT,
  start_date DATE,
  end_date DATE,
  status commessa_status NOT NULL DEFAULT 'offer',
  contract_value NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (contract_value >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT REFERENCES person(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT REFERENCES person(id),
  CONSTRAINT chk_commessa_code_format CHECK (code ~ '^\d{2}-\d{3}$')
);
CREATE INDEX idx_commessa_client_id ON commessa(client_id);
CREATE INDEX idx_commessa_status ON commessa(status);
CREATE TRIGGER trg_commessa_updated_at BEFORE UPDATE ON commessa
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE service (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  commessa_id BIGINT NOT NULL REFERENCES commessa(id),
  service_type_id BIGINT NOT NULL REFERENCES service_type(id),
  variant TEXT,                             -- libero, per casi eccezionali
  pm_id BIGINT REFERENCES person(id),
  template_name TEXT,                       -- riferimento "morbido" a phase_template.template_name
  start_date DATE,
  end_date DATE,
  status service_status NOT NULL DEFAULT 'active',
  consultant_cost_budget NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (consultant_cost_budget >= 0),
  markup NUMERIC(6,4) NOT NULL DEFAULT 1.30 CHECK (markup > 0),
  contracted_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (contracted_price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT REFERENCES person(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT REFERENCES person(id),
  CONSTRAINT chk_service_code_format CHECK (code ~ '^\d{2}-\d{3}-[A-Z]$')
);
CREATE INDEX idx_service_commessa_id ON service(commessa_id);
CREATE INDEX idx_service_service_type_id ON service(service_type_id);
CREATE INDEX idx_service_pm_id ON service(pm_id);
CREATE INDEX idx_service_status ON service(status);
CREATE TRIGGER trg_service_updated_at BEFORE UPDATE ON service
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- cost_rate_snapshot / sold_rate_snapshot: copiati da person->level al
-- momento dell'INSERT (decisione confermata). Un cambio tariffa successivo
-- sul Livello non li altera più.
CREATE TABLE assignment (
  id BIGSERIAL PRIMARY KEY,
  service_id BIGINT NOT NULL REFERENCES service(id),
  person_id BIGINT NOT NULL REFERENCES person(id),
  project_role project_role NOT NULL,
  estimated_hours NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (estimated_hours >= 0),
  cost_rate_snapshot NUMERIC(8,2) NOT NULL CHECK (cost_rate_snapshot >= 0),
  sold_rate_snapshot NUMERIC(8,2) NOT NULL CHECK (sold_rate_snapshot >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT REFERENCES person(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT REFERENCES person(id),
  UNIQUE (service_id, person_id)
);
CREATE INDEX idx_assignment_service_id ON assignment(service_id);
CREATE INDEX idx_assignment_person_id ON assignment(person_id);
CREATE TRIGGER trg_assignment_updated_at BEFORE UPDATE ON assignment
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- baseline_date: nessun vincolo DB può impedire una UPDATE (un CHECK non può
-- confrontare col valore precedente). baseline_confirmed blocca il campo in
-- UI dopo la conferma iniziale, con eventuale avviso se qualcuno la forza.
CREATE TABLE phase (
  id BIGSERIAL PRIMARY KEY,
  service_id BIGINT NOT NULL REFERENCES service(id),
  sort_order INT NOT NULL,
  name TEXT NOT NULL,
  template_name TEXT,
  owner_id BIGINT REFERENCES person(id),
  baseline_date DATE,
  baseline_confirmed BOOLEAN NOT NULL DEFAULT false,
  planned_date DATE,
  actual_date DATE,
  predecessor_phase_id BIGINT REFERENCES phase(id),
  contractual_milestone BOOLEAN NOT NULL DEFAULT false,
  progress_pct NUMERIC(5,4) NOT NULL DEFAULT 0 CHECK (progress_pct >= 0 AND progress_pct <= 1),
  hours_quota_pct NUMERIC(6,4) CHECK (hours_quota_pct >= 0 AND hours_quota_pct <= 1),
  expected_deliverable TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT REFERENCES person(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT REFERENCES person(id)
);
CREATE INDEX idx_phase_service_id ON phase(service_id);
CREATE INDEX idx_phase_predecessor_id ON phase(predecessor_phase_id);
CREATE TRIGGER trg_phase_updated_at BEFORE UPDATE ON phase
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE billing_milestone (
  id BIGSERIAL PRIMARY KEY,
  service_id BIGINT NOT NULL REFERENCES service(id),
  type milestone_type NOT NULL,
  description TEXT,
  basis milestone_basis NOT NULL,
  percentage NUMERIC(6,4) CHECK (percentage >= 0 AND percentage <= 1),
  fixed_amount NUMERIC(12,2) CHECK (fixed_amount >= 0),
  trigger_phase_id BIGINT REFERENCES phase(id),
  planned_issue_date DATE,
  issue_date DATE,
  invoice_number TEXT,
  collection_status collection_status NOT NULL DEFAULT 'to_issue',
  collection_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT REFERENCES person(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT REFERENCES person(id),
  CONSTRAINT chk_milestone_basis CHECK (
    (basis = 'percentage' AND percentage IS NOT NULL AND fixed_amount IS NULL) OR
    (basis = 'fixed' AND fixed_amount IS NOT NULL AND percentage IS NULL)
  )
);
CREATE INDEX idx_billing_milestone_service_id ON billing_milestone(service_id);
CREATE INDEX idx_billing_milestone_trigger_phase_id ON billing_milestone(trigger_phase_id);
CREATE TRIGGER trg_billing_milestone_updated_at BEFORE UPDATE ON billing_milestone
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Header + righe (non il workaround Excel di ripetere il numero ordine).
CREATE TABLE purchase_order (
  id BIGSERIAL PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  supplier_id BIGINT NOT NULL REFERENCES supplier(id),
  description TEXT,
  status po_status NOT NULL DEFAULT 'requested',
  issue_date DATE,
  expected_delivery_date DATE,
  approver_id BIGINT REFERENCES person(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT REFERENCES person(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT REFERENCES person(id)
);
CREATE INDEX idx_po_supplier_id ON purchase_order(supplier_id);
CREATE INDEX idx_po_status ON purchase_order(status);
CREATE TRIGGER trg_po_updated_at BEFORE UPDATE ON purchase_order
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- phase_ref: testo libero, non FK — così come nella spec (non un riferimento
-- rigido a Phase, per lasciare la nota descrittiva flessibile).
CREATE TABLE purchase_order_line (
  id BIGSERIAL PRIMARY KEY,
  purchase_order_id BIGINT NOT NULL REFERENCES purchase_order(id),
  service_id BIGINT NOT NULL REFERENCES service(id),
  phase_ref TEXT,
  consultant_cost NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (consultant_cost >= 0),
  recharged_to_client NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (recharged_to_client >= 0),
  invoiced_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (invoiced_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT REFERENCES person(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT REFERENCES person(id)
);
CREATE INDEX idx_po_line_po_id ON purchase_order_line(purchase_order_id);
CREATE INDEX idx_po_line_service_id ON purchase_order_line(service_id);
CREATE TRIGGER trg_po_line_updated_at BEFORE UPDATE ON purchase_order_line
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Granularità mensile per scelta di progetto (§3/§12 della spec): il
-- dettaglio giornaliero non aggiunge valore decisionale a questa scala.
CREATE TABLE time_entry (
  id BIGSERIAL PRIMARY KEY,
  month CHAR(7) NOT NULL,                   -- 'YYYY-MM'
  service_id BIGINT NOT NULL REFERENCES service(id),
  phase_id BIGINT REFERENCES phase(id),
  person_id BIGINT NOT NULL REFERENCES person(id),
  hours NUMERIC(8,2) NOT NULL CHECK (hours >= 0),
  source time_entry_source NOT NULL DEFAULT 'manual',
  cost_rate_snapshot NUMERIC(8,2) NOT NULL CHECK (cost_rate_snapshot >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT REFERENCES person(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT REFERENCES person(id),
  CONSTRAINT chk_time_entry_month_format CHECK (month ~ '^\d{4}-(0[1-9]|1[0-2])$')
);
CREATE INDEX idx_time_entry_service_month ON time_entry(service_id, month);
CREATE INDEX idx_time_entry_person_id ON time_entry(person_id);
CREATE TRIGGER trg_time_entry_updated_at BEFORE UPDATE ON time_entry
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Nessuna updated_at: è un log di giudizi storici, non un record da
-- modificare in place. Una nuova previsione supersede la precedente
-- impostando is_current = false su quella (gestito a livello applicativo,
-- non con un trigger, per lasciare visibile chi/quando ha superseduto cosa).
CREATE TABLE hours_forecast (
  id BIGSERIAL PRIMARY KEY,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  quarter TEXT NOT NULL,                    -- es. '2026-Q3'
  service_id BIGINT NOT NULL REFERENCES service(id),
  person_id BIGINT NOT NULL REFERENCES person(id),
  etc_hours NUMERIC(8,2) NOT NULL CHECK (etc_hours >= 0),
  is_current BOOLEAN NOT NULL DEFAULT true,
  recorded_by_id BIGINT REFERENCES person(id),
  notes TEXT,
  CONSTRAINT chk_quarter_format CHECK (quarter ~ '^\d{4}-Q[1-4]$')
);
CREATE INDEX idx_hours_forecast_current ON hours_forecast(service_id, person_id, is_current);

CREATE TABLE offer (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  client_id BIGINT NOT NULL REFERENCES client(id),
  asset_name TEXT,
  proposed_services TEXT,                   -- elenco libero, pre-contratto
  version INT NOT NULL DEFAULT 1,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  probability_pct NUMERIC(5,4) CHECK (probability_pct >= 0 AND probability_pct <= 1),
  status offer_status NOT NULL DEFAULT 'draft',
  sent_date DATE,
  expected_decision_date DATE,
  loss_reason TEXT,
  generated_commessa_id BIGINT REFERENCES commessa(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT REFERENCES person(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT REFERENCES person(id)
);
CREATE INDEX idx_offer_client_id ON offer(client_id);
CREATE INDEX idx_offer_status ON offer(status);
CREATE TRIGGER trg_offer_updated_at BEFORE UPDATE ON offer
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Singleton: una sola riga (id = 1), imposta dal CHECK.
CREATE TABLE settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  default_markup NUMERIC(6,4) NOT NULL DEFAULT 1.30 CHECK (default_markup > 0),
  pm_approval_threshold NUMERIC(12,2) NOT NULL DEFAULT 5000 CHECK (pm_approval_threshold >= 0),
  director_approval_threshold NUMERIC(12,2) NOT NULL DEFAULT 15000 CHECK (director_approval_threshold >= 0),
  hours_alert_threshold NUMERIC(5,4) NOT NULL DEFAULT 0.85 CHECK (hours_alert_threshold >= 0),
  max_acceptable_discount NUMERIC(5,4) NOT NULL DEFAULT 0.10 CHECK (max_acceptable_discount >= 0),
  payment_terms_days INT NOT NULL DEFAULT 60 CHECK (payment_terms_days >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT REFERENCES person(id)
);
CREATE TRIGGER trg_settings_updated_at BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
