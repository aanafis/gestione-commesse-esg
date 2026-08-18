-- 0010_po_line_description_in_view.sql
-- Espone purchase_order_line.description (aggiunta in 0009) nella vista.
-- CREATE OR REPLACE VIEW, non un ALTER della 0003 già applicata — la
-- cronologia delle migration resta quella davvero eseguita in ordine.

BEGIN;

CREATE OR REPLACE VIEW v_purchase_order_line_metrics AS
SELECT
  l.id AS line_id,
  l.purchase_order_id,
  l.service_id,
  l.phase_ref,
  l.consultant_cost,
  l.recharged_to_client,
  l.invoiced_amount,
  po.status AS po_status,
  (po.status IN ('issued', 'delivered', 'invoiced', 'paid')) AS is_committed,
  l.recharged_to_client / NULLIF(l.consultant_cost, 0) AS markup_applied,
  l.recharged_to_client - l.consultant_cost AS line_margin,
  l.description
FROM purchase_order_line l
JOIN purchase_order po ON po.id = l.purchase_order_id;

COMMIT;
