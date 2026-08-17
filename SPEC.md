# ESG Project Management Tool — Specification

Rebuild of an Excel-based tool (`Gestione_Commesse_ESG_v4.xlsm`) as a multi-user web
application for a 4-person ESG & Sustainability consulting business unit in Italy.

**Read this document fully before writing any code.** The Excel file contains ~17,700
formulas; the business rules below are the source of truth, not the formulas.

---

## 0. How to use this spec

Suggested build order — do not skip ahead:

1. Database schema + migrations + seed data → **stop and confirm with the user**
2. Read-only views (dashboard, service detail, hours control)
3. Data entry forms
4. Authentication
5. Deployment

The user is a domain expert, not a developer. Explain tradeoffs in business terms.
Ask before inventing business logic that is not in this document.

### Language

- **Code, tables, columns, variables: English.**
- **All user-facing UI text: Italian.** The team works in Italian.
- Glossary in §11 maps Italian domain terms to the English identifiers used here.

---

## 1. Business context

The unit sells sustainability certification and advisory services to real estate
clients in Italy: LEED, WELL, BREEAM, WiredScore, Fitwel, CRREM, Access4You,
GRESB, EU Taxonomy, Climate Risk, BiodiverCity.

Four people. ~10–30 active engagements at a time. The tool must answer:

- What margin am I making on each service, including costs not yet incurred?
- How much have I already committed to suppliers, even before invoices arrive?
- Are we over the estimated hours, and on which person?
- What can I invoice right now?
- How much discount are we giving away in negotiation?

### Two-level structure

A **commessa** is the contractual container: one client, one building, one contract.
Under it sit **services** — LEED, WELL, CRREM — each with its own code, price and margin.

All operational data attaches to the **service**, never to the commessa: phases,
purchase orders, billing milestones, hours. The commessa only aggregates.

Example: commessa `26-014` worth €58,700 contains `26-014-A` (LEED),
`26-014-B` (WELL), `26-014-C` (CRREM).

---

## 2. The central pricing rule

**This is the most important rule in the system. Price is an output, not an input.**

The sale price is built bottom-up from two components:

```
consultant_price = consultant_cost_budget × markup
hours_price      = Σ over assignments (estimated_hours × person.sold_rate)
calculated_price = consultant_price + hours_price
```

`contracted_price` is entered separately — what the client actually signed.

```
discount     = contracted_price − calculated_price
discount_pct = discount / calculated_price
```

A negative discount means margin given away in negotiation. This number did not exist
in the previous version of the tool and is one of the main reasons for the rebuild.

Margin:

```
hours_cost_to_complete      = Σ over assignments (eac_hours × person.internal_cost_rate)
consultant_cost_to_complete = MAX(committed_consultant_cost, consultant_cost_budget)
total_cost_to_complete      = hours_cost_to_complete + consultant_cost_to_complete
margin_to_complete          = contracted_price − total_cost_to_complete
margin_pct                  = margin_to_complete / contracted_price

hours_margin      = hours_price − hours_cost_to_complete
consultant_margin = consultant_price − consultant_cost_to_complete
```

Splitting margin into hours vs consultants matters: they are two different businesses
with different dynamics, and the user needs to see which one generates the money.

### Markup

`markup` is a **multiplier**, not a percentage: 1.30 means cost +30%. It varies per
service and is entered each time. Default 1.30, configurable.

### Registration fees are excluded

Fees paid to certification bodies (GBCI, IWBI, BRE, WiredScore) are **never** recorded
in this system. They are pass-through items — paid directly by the client, or advanced
and recharged at cost — and do not affect margin. Do not add a field for them.

---

## 3. Hours: three distinct concepts

| Concept | Meaning | Source | Who produces it |
|---|---|---|---|
| `estimated_hours` | Hours we expect to spend. Basis of the price. | Assignment | PM, at offer stage |
| `actual_hours` | Hours actually worked. | TimeEntry | monthly timesheet import |
| `etc_hours` | Estimate to Complete: hours still needed from today. | HoursForecast | PM, quarterly |

```
eac_hours = actual_hours + etc_hours          (EAC = Estimate at Completion)
```

If no current forecast exists for a person/service pair, fall back to:

```
eac_hours = MAX(actual_hours, estimated_hours)
```

**Do not auto-calculate ETC as `estimated − actual`.** That gives remaining *budget*,
not remaining *work*. The whole point of ETC is that the PM looks at the real state of
the project and makes a judgement. The system may show `MAX(0, estimated − actual)` as
a *suggestion* next to the input field, but must not silently default to it — the
forecast history is valuable precisely because it records considered judgements.

Only the most recent forecast per (service, person) pair is current. Saving a new one
must mark previous ones as superseded. Keep the history: over several quarters it
reveals whether the team systematically underestimates.

---

## 4. Data model

Money: store as integer cents or `NUMERIC(12,2)` — never float.
Hours: `NUMERIC(8,2)`.
Percentages: store as decimal fraction (0.30 = 30%).

### 4.1 Reference data

**Level** — rate card by seniority
```
id, name, internal_cost_rate, sold_rate, active
```
Example rows: Head of ESG (45 / 85), Senior (38 / 61.88), Consultant (34 / 61.88),
Junior (27 / 48). Rates in €/hour. These are examples — the user will replace them.

**Person**
```
id, name, email, level_id → Level, annual_available_hours, active
```
Cost and sold rates are inherited from the level.

> **Design decision to confirm with the user.** In Excel, rates are read live from the
> level, so a rate change retroactively revalues historical hours. In a database we can
> instead snapshot `cost_rate` and `sold_rate` onto Assignment and TimeEntry at creation
> time, freezing history. Recommend snapshotting. Ask the user before deciding.

**Client**
```
id, name, vat_number, notes
```

**Supplier**
```
id, code, name, category, contact_name, email, phone, payment_terms, vat_number, notes
```
`category` enum: commissioning agent, testing laboratory, energy modeler, acoustics,
lighting, IAQ survey, water analysis, accessibility surveyor, external technical
consultant, other.

**ServiceType** — LEED, WELL, WiredScore, BREEAM, Fitwel, CRREM, Access4You, GRESB,
EU Taxonomy, Climate Risk, BiodiverCity, ESG advisory, other. Extensible by the user.

**PhaseTemplate** — standard phase library
```
id, template_name, sort_order, phase_name, expected_deliverable,
contractual_milestone (bool), duration_days, hours_quota_pct
```
`hours_quota_pct` must sum to 1.0 per template — enforce with a validation warning.
`duration_days` are sequential offsets: phase dates cascade from the service start date.

Templates already defined (import from the Excel file's `TEMPLATE_FASI` sheet):
LEED BD+C, WELL C&S, WELL v.2, WELL Rating, WiredScore, BREEAM, Fitwel, CRREM,
Access4You, EU Taxonomy, Climate Risk, BiodiverCity, GRESB, ESG advisory.

### 4.2 Core entities

**Commessa**
```
id, code, client_id → Client, asset_name, client_contact,
start_date, end_date, status, contract_value
```
`code` format `YY-NNN` (e.g. `26-017`), unique.
`status` enum: offer, active, suspended, in certification, closed, lost.

Derived: `services_count`, `sum_of_contracted_prices`, `reconciliation_ok`
(= `|contract_value − sum_of_contracted_prices| < 1`), `total_cost_to_complete`,
`margin_to_complete`, `margin_pct`, `collected`, `to_be_invoiced`.

The reconciliation check matters: if the sum of service prices does not match the
contract value, every per-service margin is wrong. Surface it prominently.

**Service**
```
id, code, commessa_id → Commessa, service_type, variant, pm_id → Person,
template_name, start_date, end_date, status,
consultant_cost_budget, markup, contracted_price
```
`code` format `{commessa.code}-{A|B|C…}`, unique.
All other economics are derived (§2, §3).

**Assignment** — who works on what, and the hours estimate that builds the price
```
id, service_id → Service, person_id → Person, project_role, estimated_hours
```
Unique on (service_id, person_id).
`project_role` enum: project manager, supervision, documentation, site inspections,
data analysis, support.

Derived per assignment: `hours_price`, `hours_cost`, `estimated_margin`,
`actual_hours`, `etc_hours`, `eac_hours`, `variance`, `eac_cost`, `eac_value`,
`consumed_pct`.

**Phase**
```
id, service_id → Service, sort_order, name, template_name, owner_id → Person,
baseline_date, planned_date, actual_date, predecessor_phase_id,
contractual_milestone, progress_pct, hours_quota_pct, expected_deliverable
```
Generated from PhaseTemplate when a service is created, then edited.

`baseline_date` is set once and **must never change afterwards** — it is the reference
for measuring slippage. Make it read-only in the UI after initial confirmation, or at
least warn on edit. `planned_date` moves as the plan changes.

Derived: `status` (not started / in progress / completed / **overdue**),
`days_late`, `baseline_variance_days`, `actual_hours_on_phase`,
`indicative_hours` (= `hours_quota_pct × service.estimated_hours`, informational only).

**BillingMilestone** (Italian: SAL)
```
id, service_id → Service, type, description, basis, percentage, fixed_amount,
trigger_phase_id → Phase, planned_issue_date, issue_date, invoice_number,
collection_status, collection_date
```
`type` enum: advance, interim, balance, extra.
`basis` enum: percentage | fixed.
`amount` = if percentage: `percentage × service.contracted_price`, else `fixed_amount`.
`collection_status` enum: to issue, issued, collected, overdue, disputed.

**Trigger logic — important.** When `trigger_phase.progress_pct >= 1.0` and no
`issue_date` is set, the milestone becomes `ISSUABLE`. This must surface on the
dashboard as "ready to invoice now". It prevents the most common revenue leak in this
business: delivering something and forgetting to bill it for two months.

In Excel the trigger matched phase *names* as text, which was fragile. Here use a
proper foreign key to the phase.

**PurchaseOrder** (Italian: ODA) — header + lines

A single order to a consultant may cover several services. In Excel this was worked
around by repeating the order number across rows. Model it properly:

```
PurchaseOrder:
  id, number, supplier_id → Supplier, description, status,
  issue_date, expected_delivery_date, approver_id → Person, notes

PurchaseOrderLine:
  id, purchase_order_id → PurchaseOrder, service_id → Service, phase_ref,
  consultant_cost, recharged_to_client, invoiced_amount
```

`status` enum: requested, approved, **issued**, delivered, invoiced, paid, cancelled.

Cost counts as *committed* only when status is `issued` or later. This is the number
the tool exists to expose: money already spent in decision terms, before any invoice
arrives.

Per line: `markup_applied = recharged_to_client / consultant_cost`,
`line_margin = recharged_to_client − consultant_cost`.

Approval level from thresholds (§5): autonomous / project manager / director.

**TimeEntry** (Italian: ORE)
```
id, month (YYYY-MM), service_id → Service, phase_id → Phase (nullable),
person_id → Person, hours, source
```
Monthly granularity by design — daily detail is unnecessary for margin control and
makes the table unmanageable. Fed by a monthly import from the existing timesheet
system; build a CSV import with column mapping.

**HoursForecast** (Italian: PREVISIONE_ORE)
```
id, recorded_at, quarter, service_id → Service, person_id → Person,
etc_hours, is_current (bool), recorded_by_id → Person, notes
```
Saving a new forecast sets `is_current = false` on prior rows for the same
(service, person).

**Offer**
```
id, code, client_id, asset_name, proposed_services, version, amount,
probability_pct, status, sent_date, expected_decision_date, loss_reason,
generated_commessa_id → Commessa
```
`weighted_value = amount × probability_pct`.
`status` enum: draft, sent, negotiating, won, lost, withdrawn.

**Settings** — single-row configuration table
```
default_markup (1.30), pm_approval_threshold (5000), director_approval_threshold (15000),
hours_alert_threshold (0.85), max_acceptable_discount (0.10), payment_terms_days (60)
```

---

## 5. Derived values reference

Implement these as database views or computed server-side. Do not duplicate the logic
in the frontend.

### Service level

```
consultant_price            = consultant_cost_budget × markup
estimated_hours             = Σ assignments.estimated_hours
hours_price                 = Σ assignments.hours_price
calculated_price            = consultant_price + hours_price
discount                    = contracted_price − calculated_price
discount_pct                = discount / calculated_price

committed_consultant_cost   = Σ PO lines where status >= issued
recharged_to_client         = Σ PO lines recharged_to_client
supplier_invoiced           = Σ PO lines invoiced_amount
effective_markup            = recharged_to_client / committed_consultant_cost

actual_hours                = Σ time entries
etc_hours                   = Σ current forecasts
eac_hours                   = Σ assignments.eac_hours
hours_variance              = eac_hours − estimated_hours

hours_cost_to_complete      = Σ assignments (eac_hours × cost_rate)
consultant_cost_to_complete = MAX(committed_consultant_cost, consultant_cost_budget)
total_cost_to_complete      = hours_cost_to_complete + consultant_cost_to_complete
margin_to_complete          = contracted_price − total_cost_to_complete
margin_pct                  = margin_to_complete / contracted_price
hours_margin                = hours_price − hours_cost_to_complete
consultant_margin           = consultant_price − consultant_cost_to_complete

phase_progress_pct          = AVG(phases.progress_pct)
hours_consumed_pct          = actual_hours / estimated_hours

invoiced_to_client          = Σ milestones where status in (issued, collected, overdue)
collected                   = Σ milestones where status = collected
to_be_invoiced              = contracted_price − invoiced_to_client
cash_exposure               = supplier_invoiced − collected

effective_hourly_revenue    = hours_price / eac_hours
```

`effective_hourly_revenue` is the most honest single number the system produces: if it
falls below the team's internal cost rate, that service is losing money on hours
regardless of how the headline margin looks. Show it prominently.

Guard every division against zero.

### Alerts

One alert per service, the most severe active one. Order matters — it is designed to
surface the *cause*, not the symptom:

| Priority | Alert | Condition |
|---|---|---|
| 1 | `RISORSE NON ASSEGNATE` | `estimated_hours = 0` |
| 2 | `MARGINE CRITICO` | `margin_pct < 0.10` |
| 3 | `SCONTO OLTRE SOGLIA` | `discount_pct < −max_acceptable_discount` |
| 4 | `ORE OLTRE LA STIMA` | `hours_variance > 0` |
| 5 | `CONSUMO ORE ELEVATO` | `hours_consumed_pct > hours_alert_threshold` |
| 6 | `SAL DA EMETTERE` | any milestone is ISSUABLE |
| 7 | `FASI IN RITARDO` | any phase overdue |
| 8 | `OK` | none of the above |

Per-assignment alert: `SFORAMENTO OLTRE 15%` if `variance > estimated_hours × 0.15`,
else `SOPRA LA STIMA` if `variance > 0`, else `CONSUMO ELEVATO` if
`consumed_pct > threshold`, else `OK`.

**The comparison that matters most**, and which should be visually prominent
everywhere: `hours_consumed_pct` against `phase_progress_pct`. A gap above 15 points
means the service is burning hours faster than it is advancing — visible months before
it shows up in the margin.

---

## 6. Screens

Italian UI labels shown in quotes.

### 6.1 Dashboard — "Cruscotto"
Landing page. Read-only. Portfolio-wide, active services only.

- Portfolio: calculated vs contracted price, **total discount given**, margin, margin %
- Hours: estimated / actual / ETC / EAC / variance, effective hourly revenue
- Consultants: budgeted cost, committed, recharged, planned vs effective markup
- Team load: available hours, EAC, **utilisation %**
- Billing: **issuable milestones (amount + count)**, issued not collected, overdue, cash exposure
- Progress: overdue phases, open offers, weighted pipeline
- Breakdown by service type: count, price, margin, margin %, estimated hours, EAC

Issuable milestones should be the most visually prominent item — it is money on the table.

### 6.2 Service list — "Servizi"
Filterable table, one row per service, with the alert as a coloured status chip.
Filter by: status, PM, service type, alert, client. Sort by margin, discount, variance.

### 6.3 Service detail — "Scheda servizio"
The main working screen. Three panels:

- **Left**: identity, client/asset, alert, overdue phases, issuable milestones
- **Centre — price composition**: consultant cost → × markup → consultant price;
  hours price; = calculated price; vs contracted price; = **discount**. Then cost
  structure down to margin, split into hours margin and consultant margin.
- **Right — hours**: estimated / actual / consumed % / progress % / ETC / EAC /
  variance, then invoiced / collected / to invoice

Below, tabs: Assignments · Phases · Billing milestones · Purchase orders · Time · Forecasts

### 6.4 Hours control — "Controllo ore"
Three sections:
1. By service: estimated, actual, consumed % vs progress %, **delta**, ETC, EAC, variance, hours margin
2. By person: individual verification — every person on every service
3. Monthly load matrix: hours per person per month, 12-month rolling window, utilisation %

### 6.5 Entry forms
New commessa · New service · Assign resource · Log purchase order · Update phase
progress · Record quarterly forecast · Import time entries (CSV).

**The assign-resource form is where the price gets built.** While entering hours, show
live: the person's rates, the price and margin of this assignment, the running service
price total, and the gap versus the contracted price. That gap, once all resources are
assigned, is the real discount.

### 6.6 Admin
Levels and rate card · People · Clients · Suppliers · Phase templates · Settings.

---

## 7. Authentication

4 users, all internal, whitelisted by email.

**Recommended: magic link.** User enters their work email, receives a one-time login
link, session cookie thereafter. No passwords to store or reset.

If the user insists on a PIN, use **individual PINs per person**, never a shared one:
- Store hashed (bcrypt/argon2), never plaintext
- Rate limit: lock for 15 minutes after 5 failed attempts
- Session expiry after inactivity
- HTTPS mandatory

**Why this matters here:** the database holds client contract values, margins, and
individual hourly cost rates. Cost rates are close enough to salary data that under
GDPR they warrant proper protection, and internal exposure would be awkward.

Roles: `admin` (full access, rate card, settings) and `member` (everything else).
Track `created_by` / `updated_at` on all mutable records — with four people sharing a
system, knowing who changed what resolves most disputes.

---

## 8. Non-negotiable behaviours

Carried over from the Excel version, learned the hard way:

1. **Price is derived from hours.** Never allow a service price to be entered directly
   as the hours component.
2. **Baseline dates never change** after initial confirmation.
3. **No supplier work without a purchase order.** The whole committed-cost mechanism
   depends on orders being logged *before* the work starts, not when the invoice arrives.
4. **Registration fees stay out** of the system entirely.
5. **Reconciliation check**: sum of service contracted prices must equal the commessa
   contract value. Warn loudly when it does not.
6. **Hours quota per template must total 100%.**
7. **A milestone becomes issuable automatically** when its trigger phase completes.

---

## 9. Migration from Excel

The user has a pilot commessa already loaded. Provide a CSV import path, or accept
`.xlsx` directly, mapping sheets → tables:

| Excel sheet | Target table |
|---|---|
| LISTE (rate table M3:Q12) | Level |
| TEAM | Person |
| FORNITORI | Supplier |
| COMMESSE | Commessa |
| SERVIZI | Service |
| ASSEGNAZIONI | Assignment |
| FASI | Phase |
| SAL | BillingMilestone |
| ODA | PurchaseOrder + PurchaseOrderLine |
| ORE | TimeEntry |
| PREVISIONE_ORE | HoursForecast |
| OFFERTE | Offer |
| TEMPLATE_FASI | PhaseTemplate |

Import all calculated columns as *ignored* — recompute everything from the rules above.
Then reconcile: total margin and total EAC hours should match the Excel figures. Any
discrepancy means a rule was misread; investigate before proceeding.

---

## 10. Explicitly out of scope (for now)

- Accounting integration
- Automated email notifications — *desirable later*: notify when a milestone becomes
  issuable, or a phase goes overdue. Do not build in v1.
- Gantt rendering with dependency constraints. Phases have a `predecessor` field but
  a full critical-path engine is not wanted — certification phases are largely
  sequential and driven by construction timing.
- Client-facing access. Internal only.
- Multi-currency. Euro only.

---

## 11. Glossary — Italian ↔ English

| Italian | English | Notes |
|---|---|---|
| Commessa | Commessa / Engagement | Keep the Italian word in the UI |
| Servizio | Service | LEED, WELL, CRREM… |
| ODA (Ordine di Acquisto) | Purchase order | To external consultants |
| SAL | Billing milestone | Stato Avanzamento Lavori |
| Fase | Phase | |
| Ore stimate | Estimated hours | Basis of the price |
| Ore consuntivo | Actual hours | From timesheet |
| ETC | Estimate to Complete | Hours still needed |
| EAC | Estimate at Completion | actual + ETC |
| Ricarico / Markup | Markup | Multiplier, e.g. 1.30 |
| Ribaltato al cliente | Recharged to client | |
| Sconto | Discount | contracted − calculated |
| Margine a finire | Margin to complete | |
| Esposizione di cassa | Cash exposure | supplier invoiced − collected |
| Livello | Level | Seniority band with rates |
| Fornitore | Supplier | |
| Preventivo / Offerta | Offer | Pre-contract |
| Quadratura | Reconciliation | |
| Avanzamento | Progress | |

---

## 12. Design decisions and their rationale

Recorded so they are not accidentally reversed.

**Two levels (commessa → services) rather than one flat table.** The first version had
a single `Servizio` column per commessa. It broke as soon as one building carried
LEED + WELL + CRREM: there was no way to see which service made money. Restructuring
cost a full rebuild. Do not flatten it back.

**Price built from hours, not decomposed from a total.** An earlier version took the
total price and divided by a standard rate to infer hours sold. That produced an
approximate number and forced the user to calculate prices outside the tool. Building
upward makes the tool useful at offer stage and makes underpricing structurally
impossible — the only way to go below cost is to discount, and discount is now visible.

**Rates by level, not per person.** Individual rates meant updating four rows to change
senior rates. Levels mean one row. People inherit.

**Markup per service, not global.** It genuinely varies deal by deal, typically around
1.30 but not fixed.

**ETC is a human judgement, not a calculation.** See §3.

**Registration fees excluded.** They are pass-through and would distort margin.

**Monthly hours granularity.** Daily detail adds volume without adding decision value
at this scale.

**Purchase orders as header + lines.** One order can cover several services; the Excel
workaround of repeating the order number was fragile.

---

## 13. Notes for the assistant

- The user is an ESG consultant and BU director. Technically capable, not a programmer.
  Explain choices in business terms; avoid unexplained jargon.
- **Confirm the schema before building on top of it.** The Excel version was rebuilt
  twice because the data model was settled too late. That is the expensive mistake here.
- When something in this spec is ambiguous or seems wrong, ask rather than assume.
  Several rules here look arbitrary but encode real business practice.
- Keep the Excel file running in parallel until the app has survived a full monthly
  cycle: import hours, check margins, issue an invoice from a triggered milestone.
- Prefer working software at each stage over everything half-built.
