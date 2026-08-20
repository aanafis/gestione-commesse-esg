-- 0012_purchase_order_pdf.sql
-- PDF dell'ODA emesso (richiesta dall'utente) — un file per ordine di
-- acquisto, non per riga: un ordine può coprire più servizi (§4.2) ma è
-- un solo documento firmato. Salvato come BYTEA in Postgres, non su uno
-- storage esterno (Vercel Blob, S3...): zero servizi/chiavi nuove da
-- configurare, coerente con le scelte già fatte in questo progetto
-- (OpenStreetMap invece di Google Maps, CSV invece di xlsx) — dimensione
-- attesa (pochi ODA, pochi MB l'uno) ben dentro quello che Postgres regge
-- comodamente in una colonna.

BEGIN;

ALTER TABLE purchase_order ADD COLUMN pdf_data BYTEA;
ALTER TABLE purchase_order ADD COLUMN pdf_filename TEXT;
ALTER TABLE purchase_order ADD COLUMN pdf_uploaded_at TIMESTAMPTZ;
ALTER TABLE purchase_order ADD COLUMN pdf_uploaded_by BIGINT REFERENCES person(id);

COMMIT;
