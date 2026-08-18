// Migrazione della commessa pilota 26-017 (Adyen) da Gestione_Commesse_ESG_v4.xlsm
// (SPEC.md §9). Importa solo i dati grezzi (mai le colonne calcolate — quelle
// si ricalcolano dalle viste). Verificato prima di scrivere: margine a
// finire, costo totale a finire, margine consulenti, ore EAC e l'alert di
// entrambi i servizi ricalcolati a mano dai dati grezzi coincidono
// ESATTAMENTE con quanto mostra il file Excel (markup reale 1.554, non
// 1.55 come arrotondato a schermo).
//
// Una decisione presa con l'utente prima di eseguire questo script: la fase
// "Fase Construction – supporto cantiere" (su entrambi i servizi) aveva nel
// file una Data_Effettiva coincidente esattamente con la fine prevista del
// servizio nonostante progress_pct=50% — un probabile segnaposto, non
// un'importazione fedele: lasciata NULL qui, la fase resta "In corso",
// coerente con quanto mostra oggi il file.
//
// Uso: DATABASE_URL=... node db/import-pilot-commessa-26-017.js

const { Client } = require("pg");

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query("BEGIN");

    const person = async (name) => {
      const r = await client.query("SELECT id FROM person WHERE name = $1", [name]);
      if (r.rows.length === 0) throw new Error(`Persona non trovata: ${name}`);
      return r.rows[0].id;
    };
    const serviceType = async (name) => {
      const r = await client.query("SELECT id FROM service_type WHERE name = $1", [name]);
      if (r.rows.length === 0) throw new Error(`Tipo servizio non trovato: ${name}`);
      return r.rows[0].id;
    };

    const amitId = await person("Amit Anafi");
    const annaId = await person("Anna Vadacca");
    const giuliaId = await person("Giulia Dagradi");
    const leedTypeId = await serviceType("LEED ID+C");
    const wellTypeId = await serviceType("WELL v.2");
    const supplierRow = await client.query(
      "SELECT id FROM supplier WHERE name = 'Macro Design Studio S.r.l. Società Benefit'"
    );
    const supplierId = supplierRow.rows[0].id;

    // --- Client + Commessa ---
    const clientRow = await client.query(
      `INSERT INTO client (name, created_by, updated_by) VALUES ('Adyen', $1, $1) RETURNING id`,
      [amitId]
    );
    const clientId = clientRow.rows[0].id;

    const commessaRow = await client.query(
      `INSERT INTO commessa (code, client_id, asset_name, client_contact, start_date, end_date, status, contract_value, created_by, updated_by)
       VALUES ('26-017', $1, 'Via Colombo 6 Milano', 'Sabine Spoelstra', '2026-01-12', '2026-10-16', 'active', 97000, $2, $2)
       RETURNING id`,
      [clientId, amitId]
    );
    const commessaId = commessaRow.rows[0].id;

    // --- Servizi (markup reale 1.554, non l'1.55 mostrato a schermo — vedi nota sopra) ---
    const serviceA = await client.query(
      `INSERT INTO service (code, commessa_id, service_type_id, pm_id, template_name, start_date, end_date, status, consultant_cost_budget, markup, contracted_price, created_by, updated_by)
       VALUES ('26-017-A', $1, $2, $3, 'LEED ID+C', '2026-03-16', '2026-10-16', 'active', 33500, 1.554, 32000, $4, $4)
       RETURNING id`,
      [commessaId, leedTypeId, annaId, amitId]
    );
    const serviceAId = serviceA.rows[0].id;

    const serviceB = await client.query(
      `INSERT INTO service (code, commessa_id, service_type_id, pm_id, template_name, start_date, end_date, status, consultant_cost_budget, markup, contracted_price, created_by, updated_by)
       VALUES ('26-017-B', $1, $2, $3, 'WELL v.2', '2026-03-13', '2026-10-16', 'active', 20000, 1.554, 65000, $4, $4)
       RETURNING id`,
      [commessaId, wellTypeId, giuliaId, amitId]
    );
    const serviceBId = serviceB.rows[0].id;

    // --- Assegnazioni ---
    await client.query(
      `INSERT INTO assignment (service_id, person_id, project_role, estimated_hours, cost_rate_snapshot, sold_rate_snapshot, created_by, updated_by)
       VALUES ($1, $2, 'project_manager', 112, 38.00, 61.88, $3, $3)`,
      [serviceAId, annaId, amitId]
    );
    await client.query(
      `INSERT INTO assignment (service_id, person_id, project_role, estimated_hours, cost_rate_snapshot, sold_rate_snapshot, created_by, updated_by)
       VALUES ($1, $2, 'support', 112, 38.00, 61.88, $3, $3)`,
      [serviceBId, giuliaId, amitId]
    );

    // --- Fasi ---
    // [sortOrder, name, baselineDate, plannedDate, actualDate, milestone, progressPct, quotaPct, deliverable]
    const phasesA = [
      [1, "Preparazione offerta e presentazione", "2026-03-31", "2026-03-31", null, false, 1.0, 0.03, "Offerta tecnico-economica + scorecard preliminare"],
      [2, "Kick-off meeting", "2026-04-05", "2026-04-05", null, true, 1.0, 0.02, "Verbale kick-off, cronoprogramma, matrice responsabilità"],
      [3, "Registrazione progetto su LEED Online", "2026-04-10", "2026-04-10", null, false, 1.0, 0.02, "Conferma registrazione GBCI"],
      [4, "Fase Design – gap analysis e credit strategy", "2026-05-25", "2026-05-25", null, true, 1.0, 0.13, "Scorecard consolidata + report strategia crediti"],
      [5, "Fase Design – redazione documentazione crediti", "2026-07-24", "2026-07-24", null, false, 1.0, 0.17, "Template LEED compilati e caricati"],
      [6, "Design Review submission", "2026-07-29", "2026-07-29", null, true, 0.0, 0.03, "Ricevuta submission GBCI"],
      [7, "Risposta commenti Design Review", "2026-08-23", "2026-08-23", null, false, 0.0, 0.07, "Documentazione integrativa"],
      [8, "Gara Construction – preparazione capitolati LEED", "2026-09-17", "2026-09-17", null, false, 0.0, 0.11, "Oneri e obblighi appaltatore, CxA plan"],
      [9, "Fase Construction – supporto cantiere", "2027-03-16", "2027-03-16", null, false, 0.5, 0.13, "Verbali sopralluogo, verifica schede materiali"],
      [10, "Fase Construction – raccolta dati e collaudi", "2027-05-15", "2027-05-15", null, false, 0.0, 0.11, "Report commissioning, IAQ, gestione rifiuti"],
      [11, "Construction Review submission", "2027-05-20", "2027-05-20", null, true, 0.0, 0.03, "Ricevuta submission finale"],
      [12, "Risposta commenti Construction Review", "2027-06-14", "2027-06-14", null, false, 0.0, 0.07, "Documentazione integrativa finale"],
      [13, "Certificazione ottenuta", "2027-06-24", "2027-06-24", null, true, 0.0, 0.05, "Certificato LEED + targa"],
      [14, "Chiusura commessa e lessons learned", "2027-06-29", "2027-06-29", null, false, 0.0, 0.03, "Consuntivo economico + archivio documentale"],
    ];
    const phasesB = [
      [1, "Preparazione offerta e presentazione", "2026-03-28", "2026-03-28", null, false, 1.0, 0.03, "Offerta + scorecard WELL preliminare"],
      [2, "Kick-off meeting", "2026-04-02", "2026-04-02", null, true, 1.0, 0.02, "Verbale kick-off e matrice responsabilità"],
      [3, "Registrazione progetto WELL Online", "2026-04-07", "2026-04-07", null, false, 1.0, 0.02, "Conferma enrollment IWBI"],
      [4, "Gap analysis Precondition / Optimization", "2026-05-17", "2026-05-17", null, true, 1.0, 0.12, "Digital Scorecard compilata"],
      [5, "Fase Design – integrazione requisiti nei progetti", "2026-07-16", "2026-07-16", null, false, 1.0, 0.16, "Note tecniche per progettisti + verifiche"],
      [6, "Documentation submission", "2026-07-26", "2026-07-26", null, true, 0.0, 0.03, "Ricevuta submission IWBI"],
      [7, "Risposta Documentation Review", "2026-08-20", "2026-08-20", null, false, 0.0, 0.08, "Documentazione integrativa"],
      [8, "Gara Construction – preparazione capitolati WELL", "2026-09-14", "2026-09-14", null, false, 1.0, 0.08, "Oneri e obblighi appaltatore"],
      [9, "Fase Construction – supporto cantiere", "2027-01-12", "2027-01-12", null, false, 0.5, 0.09, "Verbali sopralluogo, verifica schede materiali"],
      [10, "Construction Review submission", "2027-01-27", "2027-01-27", null, false, 0.0, 0.05, "Ricevuta submission finale"],
      [11, "Preparazione Performance Verification", "2027-02-16", "2027-02-16", null, false, 0.0, 0.07, "Checklist pre-test e piano campionamenti"],
      [12, "Performance Verification on-site", "2027-02-26", "2027-02-26", null, true, 0.0, 0.10, "Report WELL Performance Testing Agent"],
      [13, "Risposta a Curative Action Plan", "2027-03-18", "2027-03-18", null, false, 0.0, 0.08, "Piano azioni correttive"],
      [14, "Certificazione ottenuta", "2027-03-28", "2027-03-28", null, true, 0.0, 0.04, "Certificato WELL"],
      [15, "Chiusura e pianificazione ricertificazione", "2027-04-02", "2027-04-02", null, false, 0.0, 0.03, "Promemoria scadenza 3 anni + consuntivo"],
    ];

    async function insertPhases(serviceId, templateName, ownerId, rows) {
      let previousId = null;
      for (const [sortOrder, name, baseline, planned, actual, milestone, progress, quota, deliverable] of rows) {
        const r = await client.query(
          `INSERT INTO phase (service_id, sort_order, name, template_name, owner_id, baseline_date, baseline_confirmed, planned_date, actual_date, predecessor_phase_id, contractual_milestone, progress_pct, hours_quota_pct, expected_deliverable, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8,$9,$10,$11,$12,$13,$14,$14)
           RETURNING id`,
          [serviceId, sortOrder, name, templateName, ownerId, baseline, planned, actual, previousId, milestone, progress, quota, deliverable, amitId]
        );
        previousId = r.rows[0].id;
      }
    }
    await insertPhases(serviceAId, "LEED ID+C", annaId, phasesA);
    await insertPhases(serviceBId, "WELL v.2", giuliaId, phasesB);

    // --- Ore consuntivo (foglio ORE, fonte "Navision" -> source 'import') ---
    await client.query(
      `INSERT INTO time_entry (month, service_id, person_id, hours, source, cost_rate_snapshot, created_by, updated_by)
       VALUES ('2026-06', $1, $2, 72, 'import', 38.00, $3, $3)`,
      [serviceAId, annaId, amitId]
    );
    await client.query(
      `INSERT INTO time_entry (month, service_id, person_id, hours, source, cost_rate_snapshot, created_by, updated_by)
       VALUES ('2026-06', $1, $2, 54, 'import', 38.00, $3, $3)`,
      [serviceBId, giuliaId, amitId]
    );

    // --- Previsioni ore (foglio PREVISIONE_ORE, entrambe vigenti) ---
    await client.query(
      `INSERT INTO hours_forecast (recorded_at, quarter, service_id, person_id, etc_hours, is_current, recorded_by_id)
       VALUES ('2026-06-30', '2026-Q2', $1, $2, 40, true, $3)`,
      [serviceAId, annaId, amitId]
    );
    await client.query(
      `INSERT INTO hours_forecast (recorded_at, quarter, service_id, person_id, etc_hours, is_current, recorded_by_id)
       VALUES ('2026-06-30', '2026-Q2', $1, $2, 30, true, $3)`,
      [serviceBId, giuliaId, amitId]
    );

    // --- ODA (un ordine, due righe — una per servizio) ---
    const po = await client.query(
      `INSERT INTO purchase_order (number, supplier_id, status, approver_id, created_by, updated_by)
       VALUES ('ODA-26-017-1', $1, 'requested', $2, $2, $2)
       RETURNING id`,
      [supplierId, amitId]
    );
    const poId = po.rows[0].id;
    await client.query(
      `INSERT INTO purchase_order_line (purchase_order_id, service_id, description, consultant_cost, recharged_to_client, invoiced_amount, created_by, updated_by)
       VALUES ($1, $2, 'Certificazione LEED', 33500, 52059, 0, $3, $3)`,
      [poId, serviceAId, amitId]
    );
    await client.query(
      `INSERT INTO purchase_order_line (purchase_order_id, service_id, description, consultant_cost, recharged_to_client, invoiced_amount, created_by, updated_by)
       VALUES ($1, $2, 'Certificazione WELL', 20000, 31080, 0, $3, $3)`,
      [poId, serviceBId, amitId]
    );

    await client.query("COMMIT");
    console.log("Import completato.");
    console.log({ commessaId, serviceAId, serviceBId, poId });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("FALLITO:", e);
  process.exit(1);
});
