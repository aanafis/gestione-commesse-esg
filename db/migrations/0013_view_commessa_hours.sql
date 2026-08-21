-- 0013_view_commessa_hours.sql
-- Riepilogo ore per commessa (§6.4 Controllo ore, richiesta dall'utente) —
-- somma dei servizi non chiusi della commessa. phase_progress_pct è una
-- media pesata sulle ore stimate (non una semplice media delle medie per
-- servizio, che darebbe più peso a un servizio piccolo di uno grande);
-- hours_consumed_pct e hours_progress_gap si ricalcolano sull'aggregato,
-- non si mediano i valori già calcolati per servizio — stessa logica di
-- v_service_metrics, un livello più in alto.

BEGIN;

CREATE OR REPLACE VIEW v_commessa_hours_metrics AS
WITH agg AS (
  SELECT
    sm.commessa_id,
    COUNT(*) AS services_count,
    SUM(sm.estimated_hours) AS estimated_hours,
    SUM(sm.actual_hours) AS actual_hours,
    SUM(sm.etc_hours) AS etc_hours,
    SUM(sm.eac_hours) AS eac_hours,
    SUM(sm.hours_variance) AS hours_variance,
    SUM(sm.hours_margin) AS hours_margin,
    SUM(sm.phase_progress_pct * sm.estimated_hours) AS weighted_progress_sum
  FROM v_service_metrics sm
  WHERE sm.status != 'closed'
  GROUP BY sm.commessa_id
)
SELECT
  c.id AS commessa_id,
  c.code,
  agg.services_count,
  agg.estimated_hours,
  agg.actual_hours,
  agg.actual_hours / NULLIF(agg.estimated_hours, 0) AS hours_consumed_pct,
  agg.weighted_progress_sum / NULLIF(agg.estimated_hours, 0) AS phase_progress_pct,
  (agg.actual_hours / NULLIF(agg.estimated_hours, 0))
    - (agg.weighted_progress_sum / NULLIF(agg.estimated_hours, 0)) AS hours_progress_gap,
  agg.etc_hours,
  agg.eac_hours,
  agg.hours_variance,
  agg.hours_margin
FROM commessa c
JOIN agg ON agg.commessa_id = c.id;

COMMIT;
