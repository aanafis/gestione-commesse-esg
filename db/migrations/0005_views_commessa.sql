-- 0005_views_commessa.sql
-- Vista di sola lettura — livello Commessa (SPEC.md §4.2, §5).
-- reconciliation_ok è il controllo più importante di questa vista: se la
-- somma dei prezzi dei servizi non coincide col valore di contratto, ogni
-- margine per servizio calcolato altrove è inattendibile (§4.2, §6, §8).

BEGIN;

CREATE OR REPLACE VIEW v_commessa_metrics AS
WITH svc_agg AS (
  SELECT
    commessa_id,
    COUNT(*) AS services_count,
    SUM(contracted_price) AS sum_of_contracted_prices,
    SUM(total_cost_to_complete) AS total_cost_to_complete,
    SUM(margin_to_complete) AS margin_to_complete,
    SUM(collected) AS collected,
    SUM(to_be_invoiced) AS to_be_invoiced
  FROM v_service_metrics
  GROUP BY commessa_id
)
SELECT
  c.id AS commessa_id,
  c.code,
  c.client_id,
  c.status,
  c.contract_value,
  COALESCE(sa.services_count, 0) AS services_count,
  COALESCE(sa.sum_of_contracted_prices, 0) AS sum_of_contracted_prices,
  (ABS(c.contract_value - COALESCE(sa.sum_of_contracted_prices, 0)) < 1) AS reconciliation_ok,
  COALESCE(sa.total_cost_to_complete, 0) AS total_cost_to_complete,
  COALESCE(sa.margin_to_complete, 0) AS margin_to_complete,
  COALESCE(sa.margin_to_complete, 0) / NULLIF(c.contract_value, 0) AS margin_pct,
  COALESCE(sa.collected, 0) AS collected,
  COALESCE(sa.to_be_invoiced, 0) AS to_be_invoiced
FROM commessa c
LEFT JOIN svc_agg sa ON sa.commessa_id = c.id;

COMMIT;
