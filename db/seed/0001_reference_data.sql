-- 0001_reference_data.sql
-- Dati di riferimento reali (persone, fornitori) + valori d'esempio da
-- sostituire (tariffe) + impostazioni di default.
--
-- Tariffe (Level): valori d'esempio dalla spec §4.1, differenziati per
-- livello — decisione confermata con l'utente, al posto dei valori
-- attualmente identici (38,00 € / 61,88 € per tutti) presenti nel file
-- Excel oggi, che sembrano un placeholder mai completato.
-- DA FARE: sostituire con le tariffe reali del listino.

BEGIN;

INSERT INTO level (name, internal_cost_rate, sold_rate) VALUES
  ('Head of ESG', 45.00, 85.00),
  ('Senior',       38.00, 61.88),
  ('Consulente',   34.00, 61.88),
  ('Junior',       27.00, 48.00);

-- Persone reali del team (foglio TEAM). Ore annue disponibili come da file.
-- Amit Anafi = admin (Head of ESG / BU director), gli altri = member.
INSERT INTO person (name, email, level_id, annual_available_hours, role) VALUES
  ('Amit Anafi',           'aanfi@ilprisma.com',    (SELECT id FROM level WHERE name = 'Head of ESG'), 1440, 'admin'),
  ('Giulia Dagradi',       'gdagradi@ilprisma.com', (SELECT id FROM level WHERE name = 'Senior'),       1600, 'member'),
  ('Anna Vadacca',         'avadacca@ilprisma.com', (SELECT id FROM level WHERE name = 'Senior'),       1600, 'member'),
  ('Giovanni Della Valle', 'gdvalle@ilprisma.com',  (SELECT id FROM level WHERE name = 'Senior'),       1600, 'member');

-- Tipi di servizio: elenco granulare 1:1 coi 14 template fasi reali +
-- SmartScore (usato nel file Excel ma senza template fasi ancora) + Altro.
-- GRESB omesso: presente nella spec ma non nel file Excel, non ancora
-- utilizzato — decisione confermata con l'utente.
INSERT INTO service_type (name, sort_order) VALUES
  ('LEED BD+C',      10),
  ('LEED ID+C',      20),
  ('WELL C&S',       30),
  ('WELL v.2',       40),
  ('WELL Rating',    50),
  ('WiredScore',     60),
  ('SmartScore',     70),   -- nessun template fasi definito ancora
  ('BREEAM IU',      80),
  ('Fitwel',         90),
  ('CRREM',         100),
  ('Access4You',    110),
  ('Tassonomia UE', 120),
  ('Climate Risk',  130),
  ('BiodiverCity',  140),
  ('Consulenza ESG',150),
  ('Altro',         900);

-- Fornitori reali (foglio FORNITORI). Nota: i P.IVA "2261500223" e
-- "3430200166" hanno 10 cifre invece di 11 — probabile perdita di uno zero
-- iniziale quando Excel li ha trattati come numeri anziché testo. Riportati
-- così come sono nel file; da verificare con i fornitori prima di usarli
-- per documenti fiscali.
INSERT INTO supplier (code, name, category, contact_name, email, phone, payment_terms, vat_number, notes) VALUES
  ('FOR-001', 'Macro Design Studio S.r.l. Società Benefit', 'esg_certification_body', 'arch. Paola Moschini', 'paola.moschini@macrodesignstudio.it', '3284749721', '30 gg d.f.f.m.', '2261500223', 'Fornitore storico LEED e WELL'),
  ('FOR-002', 'Greenwich Srl',                              'esg_certification_body', 'Giuseppe Zaffino',     'g.zaffino@greenwichsrl.it',           '3467032553', '30 gg d.f.f.m.', '3430200166', NULL),
  ('FOR-003', 'OGB GROUP',                                  'esg_certification_body', 'Riccardo Hopps',       'r.hopps@ogb.group',                   '3490922909', '30 gg d.f.f.m.', '15204851008', NULL),
  ('FOR-004', 'ENERLAB',                                    'esg_certification_body', 'ing. Lorenzo Elia',    'lorenzo.elia@enarlab.com',            '3334779250', '30 gg d.f.f.m.', NULL, NULL);

-- Impostazioni: valori di default dalla spec §4.1 (Settings).
INSERT INTO settings (id) VALUES (1);

COMMIT;
