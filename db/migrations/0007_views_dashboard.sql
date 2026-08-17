-- 0007_views_dashboard.sql
-- Viste di sola lettura per il Cruscotto (SPEC.md §6.1). Tutte scoperte sui
-- soli servizi attivi, coerente con l'introduzione del §6.1: "Portfolio-wide,
-- active services only".

BEGIN;

-- Sezioni "Portfolio", "Ore", "Consulenti" del Cruscotto.
-- I totali additivi (prezzi, ore, costi) vanno a 0 quando non ci sono
-- ancora servizi attivi — è un dato reale ("zero"), non un'assenza di dato.
-- Le percentuali/rapporti restano NULL in quel caso (0% sarebbe fuorviante:
-- non significa "margine zero", significa "nessun dato su cui calcolarlo").
CREATE OR REPLACE VIEW v_dashboard_portfolio AS
SELECT
  COUNT(*) AS active_services_count,
  COALESCE(SUM(calculated_price), 0) AS total_calculated_price,
  COALESCE(SUM(contracted_price), 0) AS total_contracted_price,
  COALESCE(SUM(discount), 0) AS total_discount,
  COALESCE(SUM(margin_to_complete), 0) AS total_margin_to_complete,
  SUM(margin_to_complete) / NULLIF(SUM(contracted_price), 0) AS total_margin_pct,
  COALESCE(SUM(estimated_hours), 0) AS total_estimated_hours,
  COALESCE(SUM(actual_hours), 0) AS total_actual_hours,
  COALESCE(SUM(etc_hours), 0) AS total_etc_hours,
  COALESCE(SUM(eac_hours), 0) AS total_eac_hours,
  COALESCE(SUM(eac_hours) - SUM(estimated_hours), 0) AS total_hours_variance,
  SUM(hours_price) / NULLIF(SUM(eac_hours), 0) AS total_effective_hourly_revenue,
  COALESCE(SUM(consultant_cost_budget), 0) AS total_consultant_cost_budget,
  COALESCE(SUM(committed_consultant_cost), 0) AS total_committed_consultant_cost,
  COALESCE(SUM(recharged_to_client), 0) AS total_recharged_to_client,
  AVG(markup) AS avg_planned_markup,
  SUM(recharged_to_client) / NULLIF(SUM(committed_consultant_cost), 0) AS total_effective_markup
FROM v_service_metrics
WHERE status = 'active';

-- Sezione "Billing": issuable_amount/count è il numero più importante di
-- questa vista (§5, §6.1: "should be the most visually prominent item").
CREATE OR REPLACE VIEW v_dashboard_billing AS
WITH active_milestones AS (
  SELECT bm.*
  FROM v_billing_milestone_status bm
  JOIN service s ON s.id = bm.service_id
  WHERE s.status = 'active'
),
cash AS (
  SELECT SUM(supplier_invoiced) AS supplier_invoiced, SUM(collected) AS collected
  FROM v_service_metrics
  WHERE status = 'active'
)
SELECT
  COUNT(*) FILTER (WHERE is_issuable) AS issuable_count,
  COALESCE(SUM(amount) FILTER (WHERE is_issuable), 0) AS issuable_amount,
  COUNT(*) FILTER (WHERE collection_status = 'issued') AS issued_not_collected_count,
  COALESCE(SUM(amount) FILTER (WHERE collection_status = 'issued'), 0) AS issued_not_collected_amount,
  COUNT(*) FILTER (WHERE collection_status = 'overdue') AS overdue_count,
  COALESCE(SUM(amount) FILTER (WHERE collection_status = 'overdue'), 0) AS overdue_amount,
  COALESCE(MAX(cash.supplier_invoiced), 0) - COALESCE(MAX(cash.collected), 0) AS cash_exposure
FROM active_milestones, cash;

-- Sezione "Progress": fasi in ritardo (solo servizi attivi) + pipeline
-- offerte aperte (non ancora vinte/perse/ritirate).
CREATE OR REPLACE VIEW v_dashboard_progress AS
WITH overdue AS (
  SELECT COUNT(*) AS overdue_phases_count
  FROM v_phase_status ph
  JOIN service s ON s.id = ph.service_id
  WHERE s.status = 'active' AND ph.status = 'overdue'
),
pipeline AS (
  SELECT
    COUNT(*) AS open_offers_count,
    COALESCE(SUM(amount * probability_pct), 0) AS weighted_pipeline
  FROM offer
  WHERE status IN ('draft', 'sent', 'negotiating')
)
SELECT overdue.overdue_phases_count, pipeline.open_offers_count, pipeline.weighted_pipeline
FROM overdue, pipeline;

-- Sezione "Breakdown by service type".
CREATE OR REPLACE VIEW v_dashboard_by_service_type AS
SELECT
  st.id AS service_type_id,
  st.name AS service_type_name,
  COUNT(sm.service_id) AS services_count,
  COALESCE(SUM(sm.contracted_price), 0) AS total_contracted_price,
  COALESCE(SUM(sm.margin_to_complete), 0) AS total_margin_to_complete,
  SUM(sm.margin_to_complete) / NULLIF(SUM(sm.contracted_price), 0) AS margin_pct,
  COALESCE(SUM(sm.estimated_hours), 0) AS total_estimated_hours,
  COALESCE(SUM(sm.eac_hours), 0) AS total_eac_hours
FROM service_type st
LEFT JOIN v_service_metrics sm ON sm.service_type_id = st.id AND sm.status = 'active'
GROUP BY st.id, st.name;

COMMIT;
