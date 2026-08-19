-- 0011_commessa_address_geo.sql
-- Indirizzo esatto dell'asset + coordinate geografiche (richiesta
-- dall'utente): l'indirizzo si inserisce a mano nella maschera Commessa,
-- le coordinate si ricavano da lì via geocoding (Nominatim/OpenStreetMap,
-- gratuito — nessuna chiave API), per poterle mostrare su una mappa di
-- tutti i progetti ESG. NUMERIC(9,6) copre la precisione tipica di un
-- indirizzo civico (~11 cm), ben oltre quanto serve qui.

BEGIN;

ALTER TABLE commessa ADD COLUMN address TEXT;
ALTER TABLE commessa ADD COLUMN latitude NUMERIC(9,6);
ALTER TABLE commessa ADD COLUMN longitude NUMERIC(9,6);

COMMIT;
