-- 0009_purchase_order_line_description.sql
-- Un ordine multi-servizio (§4.2) può avere righe con prestazioni diverse
-- per servizio (es. "Certificazione LEED" vs "Certificazione WELL" sulla
-- stessa commessa) — emerso importando la commessa pilota reale (§9): lo
-- schema aveva solo una descrizione a livello di intero ordine.

BEGIN;

ALTER TABLE purchase_order_line ADD COLUMN description TEXT;

COMMIT;
