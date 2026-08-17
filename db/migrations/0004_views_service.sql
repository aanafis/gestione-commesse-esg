-- 0004_views_service.sql
-- Viste di sola lettura — livello Servizio (SPEC.md §5, "Service level").
-- Struttura in tre stadi (aggregati → joined → derived) per evitare di
-- ripetere le stesse formule più volte: ogni valore intermedio (es.
-- calculated_price) viene calcolato una sola volta e poi riusato per nome.

BEGIN;

CREATE OR REPLACE VIEW v_service_metrics AS
WITH assignment_agg AS (
  SELECT service_id,
    SUM(estimated_hours) AS estimated_hours,
    SUM(hours_price) AS hours_price,
    SUM(eac_hours) AS eac_hours,
    SUM(eac_cost) AS hours_cost_to_complete
  FROM v_assignment_metrics
  GROUP BY service_id
),
po_agg AS (
  SELECT service_id,
    SUM(consultant_cost) FILTER (WHERE is_committed) AS committed_consultant_cost,
    SUM(recharged_to_client) AS recharged_to_client,
    SUM(invoiced_amount) AS supplier_invoiced
  FROM v_purchase_order_line_metrics
  GROUP BY service_id
),
forecast_agg AS (
  SELECT service_id, SUM(etc_hours) AS etc_hours
  FROM hours_forecast
  WHERE is_current = true
  GROUP BY service_id
),
actual_agg AS (
  SELECT service_id, SUM(hours) AS actual_hours
  FROM time_entry
  GROUP BY service_id
),
phase_agg AS (
  SELECT service_id, AVG(progress_pct) AS phase_progress_pct
  FROM phase
  GROUP BY service_id
),
milestone_agg AS (
  SELECT service_id,
    SUM(amount) FILTER (WHERE collection_status IN ('issued', 'collected', 'overdue')) AS invoiced_to_client,
    SUM(amount) FILTER (WHERE collection_status = 'collected') AS collected
  FROM v_billing_milestone_status
  GROUP BY service_id
),
joined AS (
  SELECT
    s.id AS service_id,
    s.code,
    s.commessa_id,
    s.service_type_id,
    s.pm_id,
    s.status,
    s.consultant_cost_budget,
    s.markup,
    s.contracted_price,
    COALESCE(aa.estimated_hours, 0) AS estimated_hours,
    COALESCE(aa.hours_price, 0) AS hours_price,
    COALESCE(aa.eac_hours, 0) AS eac_hours,
    COALESCE(aa.hours_cost_to_complete, 0) AS hours_cost_to_complete,
    COALESCE(pa.committed_consultant_cost, 0) AS committed_consultant_cost,
    COALESCE(pa.recharged_to_client, 0) AS recharged_to_client,
    COALESCE(pa.supplier_invoiced, 0) AS supplier_invoiced,
    COALESCE(fa.etc_hours, 0) AS etc_hours,
    COALESCE(act.actual_hours, 0) AS actual_hours,
    pg.phase_progress_pct,
    COALESCE(ma.invoiced_to_client, 0) AS invoiced_to_client,
    COALESCE(ma.collected, 0) AS collected
  FROM service s
  LEFT JOIN assignment_agg aa ON aa.service_id = s.id
  LEFT JOIN po_agg pa ON pa.service_id = s.id
  LEFT JOIN forecast_agg fa ON fa.service_id = s.id
  LEFT JOIN actual_agg act ON act.service_id = s.id
  LEFT JOIN phase_agg pg ON pg.service_id = s.id
  LEFT JOIN milestone_agg ma ON ma.service_id = s.id
),
derived AS (
  SELECT j.*,
    consultant_cost_budget * markup AS consultant_price,
    (consultant_cost_budget * markup) + hours_price AS calculated_price,
    GREATEST(committed_consultant_cost, consultant_cost_budget) AS consultant_cost_to_complete
  FROM joined j
)
SELECT
  service_id,
  code,
  commessa_id,
  service_type_id,
  pm_id,
  status,
  consultant_cost_budget,
  markup,
  contracted_price,
  consultant_price,
  estimated_hours,
  hours_price,
  calculated_price,
  contracted_price - calculated_price AS discount,
  (contracted_price - calculated_price) / NULLIF(calculated_price, 0) AS discount_pct,
  committed_consultant_cost,
  recharged_to_client,
  supplier_invoiced,
  recharged_to_client / NULLIF(committed_consultant_cost, 0) AS effective_markup,
  actual_hours,
  etc_hours,
  eac_hours,
  eac_hours - estimated_hours AS hours_variance,
  hours_cost_to_complete,
  consultant_cost_to_complete,
  hours_cost_to_complete + consultant_cost_to_complete AS total_cost_to_complete,
  contracted_price - (hours_cost_to_complete + consultant_cost_to_complete) AS margin_to_complete,
  (contracted_price - (hours_cost_to_complete + consultant_cost_to_complete)) / NULLIF(contracted_price, 0) AS margin_pct,
  hours_price - hours_cost_to_complete AS hours_margin,
  consultant_price - consultant_cost_to_complete AS consultant_margin,
  phase_progress_pct,
  actual_hours / NULLIF(estimated_hours, 0) AS hours_consumed_pct,
  -- Il confronto che conta di più (§5): ore consumate vs avanzamento fasi.
  -- Un gap oltre 15 punti = si bruciano ore più in fretta di quanto si avanzi.
  (actual_hours / NULLIF(estimated_hours, 0)) - phase_progress_pct AS hours_progress_gap,
  invoiced_to_client,
  collected,
  contracted_price - invoiced_to_client AS to_be_invoiced,
  supplier_invoiced - collected AS cash_exposure,
  hours_price / NULLIF(eac_hours, 0) AS effective_hourly_revenue
FROM derived;

-- ============================================================
-- v_service_alert
-- ============================================================
-- Un solo alert per servizio, il più severo tra quelli attivi. L'ordine di
-- valutazione segue esattamente la tabella priorità del §5: punta a
-- mostrare la causa, non il sintomo (es. "risorse non assegnate" prima di
-- "margine critico", perché la seconda è spesso conseguenza della prima).
CREATE OR REPLACE VIEW v_service_alert AS
SELECT
  sm.service_id,
  CASE
    WHEN sm.estimated_hours = 0 THEN 'RISORSE NON ASSEGNATE'
    WHEN sm.margin_pct < 0.10 THEN 'MARGINE CRITICO'
    WHEN sm.discount_pct < -(SELECT max_acceptable_discount FROM settings) THEN 'SCONTO OLTRE SOGLIA'
    WHEN sm.hours_variance > 0 THEN 'ORE OLTRE LA STIMA'
    WHEN sm.hours_consumed_pct > (SELECT hours_alert_threshold FROM settings) THEN 'CONSUMO ORE ELEVATO'
    WHEN EXISTS (
      SELECT 1 FROM v_billing_milestone_status bm
      WHERE bm.service_id = sm.service_id AND bm.is_issuable
    ) THEN 'SAL DA EMETTERE'
    WHEN EXISTS (
      SELECT 1 FROM v_phase_status ph
      WHERE ph.service_id = sm.service_id AND ph.status = 'overdue'
    ) THEN 'FASI IN RITARDO'
    ELSE 'OK'
  END AS alert
FROM v_service_metrics sm;

COMMIT;
