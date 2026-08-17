-- 0002_views_assignment_phase.sql
-- Viste di sola lettura — livello Assignment e Phase (SPEC.md §5, §4.2).
-- Ogni divisione è protetta con NULLIF(denominatore, 0): se il divisore è
-- zero il risultato è NULL invece di un errore o di un numero inventato.

BEGIN;

-- ============================================================
-- v_assignment_metrics
-- ============================================================
-- eac_hours segue la regola del §3: se esiste una previsione corrente per
-- la coppia (servizio, persona), eac_hours = actual + etc; altrimenti
-- fallback a MAX(actual, stimate). L'ETC NON viene mai calcolato come
-- "stimate - actual" — è un giudizio umano, non una formula (§3).
CREATE OR REPLACE VIEW v_assignment_metrics AS
WITH base AS (
  SELECT
    a.id AS assignment_id,
    a.service_id,
    a.person_id,
    a.project_role,
    a.estimated_hours,
    a.cost_rate_snapshot,
    a.sold_rate_snapshot,
    COALESCE(te.actual_hours, 0) AS actual_hours,
    hf.etc_hours AS current_forecast_etc_hours
  FROM assignment a
  LEFT JOIN (
    SELECT service_id, person_id, SUM(hours) AS actual_hours
    FROM time_entry
    GROUP BY service_id, person_id
  ) te ON te.service_id = a.service_id AND te.person_id = a.person_id
  LEFT JOIN hours_forecast hf
    ON hf.service_id = a.service_id AND hf.person_id = a.person_id AND hf.is_current = true
),
with_eac AS (
  SELECT base.*,
    CASE
      WHEN current_forecast_etc_hours IS NOT NULL THEN actual_hours + current_forecast_etc_hours
      ELSE GREATEST(actual_hours, estimated_hours)
    END AS eac_hours
  FROM base
)
SELECT
  assignment_id,
  service_id,
  person_id,
  project_role,
  estimated_hours,
  cost_rate_snapshot,
  sold_rate_snapshot,
  actual_hours,
  current_forecast_etc_hours AS etc_hours,      -- NULL se nessuna previsione corrente
  eac_hours,
  estimated_hours * sold_rate_snapshot AS hours_price,
  estimated_hours * cost_rate_snapshot AS hours_cost,
  (estimated_hours * sold_rate_snapshot) - (estimated_hours * cost_rate_snapshot) AS estimated_margin,
  eac_hours - estimated_hours AS variance,
  eac_hours * cost_rate_snapshot AS eac_cost,
  eac_hours * sold_rate_snapshot AS eac_value,
  actual_hours / NULLIF(estimated_hours, 0) AS consumed_pct,
  CASE
    WHEN (eac_hours - estimated_hours) > estimated_hours * 0.15 THEN 'SFORAMENTO OLTRE 15%'
    WHEN (eac_hours - estimated_hours) > 0 THEN 'SOPRA LA STIMA'
    WHEN (actual_hours / NULLIF(estimated_hours, 0)) > (SELECT hours_alert_threshold FROM settings)
      THEN 'CONSUMO ELEVATO'
    ELSE 'OK'
  END AS alert
FROM with_eac;

-- ============================================================
-- v_phase_status
-- ============================================================
-- indicative_hours usa la somma di assignment.estimated_hours per servizio
-- direttamente (non v_service_metrics), per evitare una dipendenza
-- circolare: v_service_metrics più sotto usa AVG(progress_pct) da questa
-- stessa tabella phase per calcolare phase_progress_pct.
CREATE OR REPLACE VIEW v_phase_status AS
SELECT
  p.id AS phase_id,
  p.service_id,
  p.sort_order,
  p.name,
  p.owner_id,
  p.baseline_date,
  p.baseline_confirmed,
  p.planned_date,
  p.actual_date,
  p.predecessor_phase_id,
  p.contractual_milestone,
  p.progress_pct,
  p.hours_quota_pct,
  p.expected_deliverable,
  CASE
    WHEN p.progress_pct >= 1 OR p.actual_date IS NOT NULL THEN 'completed'
    WHEN p.planned_date IS NOT NULL AND p.planned_date < CURRENT_DATE THEN 'overdue'
    WHEN p.progress_pct > 0 THEN 'in_progress'
    ELSE 'not_started'
  END AS status,
  CASE
    WHEN NOT (p.progress_pct >= 1 OR p.actual_date IS NOT NULL)
      AND p.planned_date IS NOT NULL AND p.planned_date < CURRENT_DATE
    THEN (CURRENT_DATE - p.planned_date)
    ELSE NULL
  END AS days_late,
  CASE
    WHEN p.baseline_date IS NOT NULL AND p.planned_date IS NOT NULL
    THEN (p.planned_date - p.baseline_date)
    ELSE NULL
  END AS baseline_variance_days,
  COALESCE(hop.actual_hours_on_phase, 0) AS actual_hours_on_phase,
  p.hours_quota_pct * COALESCE(se.estimated_hours, 0) AS indicative_hours
FROM phase p
LEFT JOIN (
  SELECT phase_id, SUM(hours) AS actual_hours_on_phase
  FROM time_entry
  WHERE phase_id IS NOT NULL
  GROUP BY phase_id
) hop ON hop.phase_id = p.id
LEFT JOIN (
  SELECT service_id, SUM(estimated_hours) AS estimated_hours
  FROM assignment
  GROUP BY service_id
) se ON se.service_id = p.service_id;

COMMIT;
