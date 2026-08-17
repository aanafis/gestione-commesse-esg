# Database — ESG Project Management Tool

Schema PostgreSQL per lo step 1 del piano di build (SPEC.md §0): tabelle,
vincoli, indici e dati di riferimento. Non contiene ancora le viste per i
valori derivati (prezzi, margini, alert) — sono lo step 2.

## Struttura

```
db/
  migrations/
    0001_init_schema.sql      Tutte le tabelle, enum, vincoli, indici, trigger
  seed/
    0001_reference_data.sql   Livelli tariffe, persone, tipi servizio, fornitori, impostazioni
    0002_phase_templates.sql  137 fasi dei 14 template, estratte dal file Excel reale
```

## Come applicarli

Richiede PostgreSQL (14+ consigliato) e `psql` nel PATH.

```powershell
$env:PGPASSWORD = "..."
psql -h localhost -U <utente> -d gestione_commesse -f db/migrations/0001_init_schema.sql
psql -h localhost -U <utente> -d gestione_commesse -f db/seed/0001_reference_data.sql
psql -h localhost -U <utente> -d gestione_commesse -f db/seed/0002_phase_templates.sql
```

Se il database `gestione_commesse` non esiste ancora:
```powershell
psql -h localhost -U <utente> -d postgres -c "CREATE DATABASE gestione_commesse;"
```

Questi sono file SQL semplici, non gestiti da uno strumento di migration vero
e proprio: quando scegliamo il framework applicativo (step 2), collegheremo
uno strumento che tiene traccia delle migration già applicate. Per ora,
applicarli una volta in ordine è sufficiente.

## Punti da rivedere prima di andare oltre il pilota

- **Tariffe (`level`)**: seminate con i valori d'esempio della spec
  (Head of ESG 45/85, Senior 38/61,88, Consulente 34/61,88, Junior 27/48).
  Il file Excel oggi ha valori identici per tutti — un placeholder mai
  completato. Da sostituire con le tariffe reali del listino appena decise.
- **P.IVA fornitori**: `FOR-001` e `FOR-002` hanno P.IVA a 10 cifre invece di
  11 nel file Excel originale (probabile zero iniziale perso perché la
  colonna era formattata come numero). Riportati così come sono; da
  verificare prima di usarli su documenti fiscali.
- **`SmartScore`**: presente come tipo servizio ma senza template fasi — se
  iniziate a usarlo, serve prima definire le sue fasi in `phase_template`.
- **`GRESB`**: omesso perché non presente nel file Excel reale né mai
  usato. Va aggiunto a `service_type` (e il suo template fasi) quando serve.

## Decisioni prese (per non doverle rimettere in discussione)

- Tariffe congelate (snapshot) su `assignment.cost_rate_snapshot` /
  `sold_rate_snapshot` e `time_entry.cost_rate_snapshot` al momento della
  creazione della riga: un cambio tariffa sul Livello non altera più la
  storia già registrata.
- `service_type` è un elenco granulare (una riga per "LEED BD+C", "LEED
  ID+C", "WELL C&S"...), non una categoria generica + variante — rispecchia
  come il file Excel viene usato oggi.
- `commessa.status` e `service.status` sono due enum **diversi** (la
  Commessa può essere "offer"/"lost" prima ancora che i Servizi esistano).
