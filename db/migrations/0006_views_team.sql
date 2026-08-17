-- 0006_views_team.sql
-- Viste di sola lettura — carico squadra (SPEC.md §6.1 "Team load", §6.4
-- "Controllo ore" sezioni 2 e 3).
--
-- Per il dettaglio persona-per-servizio (§6.4, sezione 2 "by person: ogni
-- persona su ogni servizio") non serve una vista nuova: v_assignment_metrics
-- (0002) già contiene tutto, basta filtrare/joinare per person_id.

BEGIN;

-- Utilizzo per persona sui soli servizi attivi (coerente con §6.1: il
-- Cruscotto guarda solo ai servizi attivi, non a quelli chiusi/sospesi).
CREATE OR REPLACE VIEW v_person_utilisation AS
SELECT
  p.id AS person_id,
  p.name,
  p.annual_available_hours,
  COALESCE(SUM(am.eac_hours) FILTER (WHERE s.status = 'active'), 0) AS eac_hours_active,
  COALESCE(SUM(am.eac_hours) FILTER (WHERE s.status = 'active'), 0)
    / NULLIF(p.annual_available_hours, 0) AS utilisation_pct
FROM person p
LEFT JOIN v_assignment_metrics am ON am.person_id = p.id
LEFT JOIN service s ON s.id = am.service_id
WHERE p.active
GROUP BY p.id, p.name, p.annual_available_hours;

-- Matrice mensile: totale ore per persona per mese. La finestra "12 mesi
-- rolling" (§6.4, sezione 3) è un dettaglio di presentazione — la applica
-- l'app filtrando su month, non la vista.
CREATE OR REPLACE VIEW v_monthly_hours_by_person AS
SELECT
  person_id,
  month,
  SUM(hours) AS hours
FROM time_entry
GROUP BY person_id, month;

COMMIT;
