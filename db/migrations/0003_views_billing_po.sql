-- 0003_views_billing_po.sql
-- Viste di sola lettura — SAL (BillingMilestone) e ODA (PurchaseOrder).

BEGIN;

-- ============================================================
-- v_billing_milestone_status
-- ============================================================
-- amount: percentuale × prezzo contrattualizzato del servizio, oppure
-- importo fisso (§4.2 BillingMilestone).
-- is_issuable: la fase trigger è completata (progress_pct >= 1.0) e non è
-- ancora stata emessa (issue_date IS NULL) — §4.2, "Trigger logic".
-- Qui si usa una FK vera verso Phase (non un match per nome testuale come
-- in Excel), com'era richiesto esplicitamente dalla spec.
CREATE OR REPLACE VIEW v_billing_milestone_status AS
SELECT
  m.id AS milestone_id,
  m.service_id,
  m.type,
  m.description,
  m.basis,
  m.percentage,
  m.fixed_amount,
  m.trigger_phase_id,
  m.planned_issue_date,
  m.issue_date,
  m.invoice_number,
  m.collection_status,
  m.collection_date,
  CASE
    WHEN m.basis = 'percentage' THEN m.percentage * s.contracted_price
    ELSE m.fixed_amount
  END AS amount,
  (tp.progress_pct >= 1 AND m.issue_date IS NULL) AS is_issuable
FROM billing_milestone m
JOIN service s ON s.id = m.service_id
LEFT JOIN phase tp ON tp.id = m.trigger_phase_id;

-- ============================================================
-- v_purchase_order_line_metrics
-- ============================================================
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
  l.recharged_to_client - l.consultant_cost AS line_margin
FROM purchase_order_line l
JOIN purchase_order po ON po.id = l.purchase_order_id;

-- ============================================================
-- v_purchase_order_summary
-- ============================================================
-- approval_level dalle soglie in Settings (§4.2, "Approval level from
-- thresholds"): calcolato sul totale costo consulenti dell'intero ordine,
-- non riga per riga — è l'ordine nel suo complesso che viene approvato.
CREATE OR REPLACE VIEW v_purchase_order_summary AS
SELECT
  po.id AS purchase_order_id,
  po.number,
  po.supplier_id,
  po.status,
  po.issue_date,
  po.expected_delivery_date,
  po.approver_id,
  COALESCE(lines.total_consultant_cost, 0) AS total_consultant_cost,
  COALESCE(lines.total_recharged_to_client, 0) AS total_recharged_to_client,
  COALESCE(lines.total_invoiced_amount, 0) AS total_invoiced_amount,
  (po.status IN ('issued', 'delivered', 'invoiced', 'paid')) AS is_committed,
  CASE
    WHEN COALESCE(lines.total_consultant_cost, 0) <= (SELECT pm_approval_threshold FROM settings) THEN 'autonomous'
    WHEN COALESCE(lines.total_consultant_cost, 0) <= (SELECT director_approval_threshold FROM settings) THEN 'project_manager'
    ELSE 'director'
  END AS approval_level
FROM purchase_order po
LEFT JOIN (
  SELECT purchase_order_id,
    SUM(consultant_cost) AS total_consultant_cost,
    SUM(recharged_to_client) AS total_recharged_to_client,
    SUM(invoiced_amount) AS total_invoiced_amount
  FROM purchase_order_line
  GROUP BY purchase_order_id
) lines ON lines.purchase_order_id = po.id;

COMMIT;
