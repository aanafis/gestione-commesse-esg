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

- **P.IVA fornitori**: `FOR-001` e `FOR-002` hanno P.IVA a 10 cifre invece di
  11 nel file Excel originale (probabile zero iniziale perso perché la
  colonna era formattata come numero). Riportati così come sono; da
  verificare prima di usarli su documenti fiscali.
- **`SmartScore`**: presente come tipo servizio ma senza template fasi — se
  iniziate a usarlo, serve prima definire le sue fasi in `phase_template`.
- **`GRESB`**: omesso perché non presente nel file Excel reale né mai
  usato. Va aggiunto a `service_type` (e il suo template fasi) quando serve.

## Migrazione dalla commessa pilota (§9)

`db/import-pilot-commessa-26-017.js` importa la commessa reale 26-017 (Adyen)
dal file Excel — solo dati grezzi (mai colonne calcolate). Verificato prima
di eseguirlo: margine a finire, costo totale a finire, margine consulenti,
ore EAC e l'alert di entrambi i servizi, ricalcolati dai dati grezzi con le
formule del §5, coincidono **esattamente** con l'Excel (il markup mostrato
come "1,55x" è in realtà 1.554 preciso). Una fase aveva una data effettiva
che sembrava un segnaposto (coincideva esattamente con la fine servizio
nonostante avanzamento 50%) — lasciata `NULL` su decisione dell'utente.

## Decisioni prese (per non doverle rimettere in discussione)

- **Tariffe (`level`)**: listino reale confermato dall'utente il 2026-08-18 —
  38,00 € (interno) / 61,88 € (esterno), **identico per tutti i 4 livelli**.
  Sostituisce i valori d'esempio differenziati per livello seminati in una
  fase precedente (spec §4.1); l'utente ha confermato esplicitamente che il
  valore uguale-per-tutti presente nel file Excel non era un placeholder.
- Tariffe congelate (snapshot) su `assignment.cost_rate_snapshot` /
  `sold_rate_snapshot` e `time_entry.cost_rate_snapshot` al momento della
  creazione della riga: un cambio tariffa sul Livello non altera più la
  storia già registrata.
- `service_type` è un elenco granulare (una riga per "LEED BD+C", "LEED
  ID+C", "WELL C&S"...), non una categoria generica + variante — rispecchia
  come il file Excel viene usato oggi.
- `commessa.status` e `service.status` sono due enum **diversi** (la
  Commessa può essere "offer"/"lost" prima ancora che i Servizi esistano).
