# Gestione Commesse ESG

App web per il controllo di gestione di commesse e servizi ESG/sostenibilità
(LEED, WELL, BREEAM, CRREM...). Sostituisce `Gestione_Commesse_ESG_v4.xlsm`.
Specifica completa in [`SPEC.md`](./SPEC.md).

## Stack

- **Next.js** (App Router, TypeScript) — un solo progetto per pagine e server
- **Kysely** — query SQL tipizzate, tipi generati dal database reale (nessun ORM che "possiede" lo schema)
- **Tailwind CSS** — stile
- **Postgres** (Neon in sviluppo) — schema e viste in [`db/`](./db/README.md)

## Avvio in locale

```powershell
npm install
npm run dev
```

Serve un file `.env.local` con:
```
DATABASE_URL=postgresql://...
```
(quello di sviluppo è già configurato; per un nuovo ambiente vedi [`db/README.md`](./db/README.md) per creare schema e dati di riferimento).

Rigenerare i tipi TypeScript dopo una modifica allo schema/viste:
```powershell
npx kysely-codegen --url "$env:DATABASE_URL" --out-file "src\lib\db\types.ts" --camel-case
```

## Stato di avanzamento (SPEC.md §0)

- [x] 1. Schema database + migration + seed
- [x] 2. Schermate di sola lettura — **Cruscotto** (`/`), **Servizi** (`/servizi`), **Scheda servizio** (`/servizi/[id]`), **Controllo ore** (`/controllo-ore`)
- [x] 3. Maschere di inserimento dati — tutte fatte: Nuova commessa, Nuovo servizio, Assegna risorsa, Nuovo ODA, Aggiorna avanzamento fase, Previsione trimestrale, **Import ore da CSV** (`/ore/importa`, mappatura colonne + anteprima + upsert)
- [x] 4. Autenticazione — magic link (`/login`), sessione JWT nel cookie, `created_by`/`updated_by`/`recorded_by_id` ora valorizzati su tutte le maschere
- [x] 5. Deployment — **https://gestione-commesse-esg.vercel.app**, GitHub → Vercel collegati (push su `main` pubblica da solo)
- [x] Migrazione commessa pilota 26-017 (Adyen) — vedi `db/import-pilot-commessa-26-017.js`, riconciliazione con l'Excel confermata su margine, ore EAC e alert di entrambi i servizi

## Admin (§6.6)

`/admin` — riservato al ruolo `admin` (verificato sia dal layout che da ogni
Server Action, non solo dal link nascosto in header): Livelli e tariffe,
Persone (livello/ruolo/accesso al login), Clienti, Fornitori, Template fasi
(con controllo somma quote = 100%), Impostazioni (soglie di approvazione,
markup di default). Un admin non può disattivare se stesso né togliersi il
ruolo di amministratore da qui, per non restare tutti fuori per errore.

## Struttura

```
src/
  app/            pagine (App Router)
  components/     componenti UI condivisi (StatTile, AlertChip...)
  lib/
    db/           connessione Kysely + tipi generati dal database
    queries/      query per schermata, sopra le viste — nessun calcolo qui
    format.ts     formattazione it-IT (valuta, ore, percentuali)
    alert.ts      mappa alert → severità/colore
db/
  migrations/     schema + viste (SQL)
  seed/           dati di riferimento
scripts/
  test-*.ts       verifiche manuali (npx tsx scripts/<file>.ts, con DATABASE_URL
                  nell'ambiente). Esclusi dal type-check di `next build`
                  (tsconfig.json). Le azioni che scrivono dati ora richiedono una
                  sessione autenticata (getSession() legge cookies(), che fuori da
                  una richiesta reale restituisce null) — questi script verificano
                  quel guard, non più la logica di validazione sottostante.
  test-auth-http.js  verifica il flusso di login vero contro un server in
                  esecuzione (node scripts/test-auth-http.js <email>) — l'unico
                  modo affidabile di testare cookie+redirect insieme.
```

## Date: sempre UTC, mai fuso locale

Le colonne `DATE` di Postgres non hanno componente oraria/fuso — sono date di
calendario pure. `src/lib/db/index.ts` forza il parser di node-pg ad
ancorarle a mezzanotte **UTC**; `src/lib/format.ts` le formatta sempre con
`timeZone: "UTC"` esplicito. Se scrivi codice nuovo che manipola una `DATE`
(nuove maschere, nuove viste lette in JS), usa sempre i metodi `getUTC*` /
`setUTC*` di `Date`, mai quelli locali (`getDate()`, `setDate()`...) — trovato
un bug reale in fase di test (le date generate dai template fasi tornavano
spostate di un giorno) prima di questa correzione.

## Maschere di inserimento (§6.5)

Ogni maschera è una Server Action in `src/lib/actions/`, con validazione lato
server (mai fidarsi solo del client) e messaggi di errore in italiano.
`created_by`/`updated_by`/`recorded_by_id` sono valorizzati dalla sessione
autenticata (vedi sotto) — ogni azione parte con `const session = await
getSession(); if (!session) return {status:"error", ...}`.

## Autenticazione (§7)

Magic link, come raccomandato dalla spec — nessuna password.

- **Flusso**: `/login` → email → `requestMagicLink` crea un token monouso
  (hash SHA-256 in `magic_link_token`, scade in 15 minuti) → `/auth/verify?token=...`
  lo scambia per una sessione (cookie JWT firmato HS256, `src/lib/auth/session.ts`)
  → redirect a `/`.
- **Whitelist implicita**: solo le email già presenti in `person` (attive)
  ricevono un link. Stesso messaggio per email sconosciuta o persona
  disattivata — non si conferma dall'esterno quali indirizzi sono validi.
- **Sessione stateless**: nessuna tabella sessioni. Il cookie si rinnova ad
  ogni richiesta autenticata (`src/proxy.ts`) — scadenza per inattività
  (12 ore), non durata fissa dal login.
- **Protezione rotte**: `src/proxy.ts` (in Next.js 16 "Proxy" sostituisce
  "Middleware") fa il controllo ottimistico (solo il cookie); `src/lib/auth/dal.ts`
  (`getSession()`) fa anche il controllo "sicuro" — se la persona è stata
  disattivata dopo l'emissione della sessione, l'accesso si chiude subito.
- **Ruoli**: `admin`/`member` già in sessione, nessuna maschera attuale li
  distingue ancora (nessuna richiede accesso riservato per ora) — pronti per
  quando costruiremo l'Admin (§6.6: listino tariffe, impostazioni).

### Modalità sviluppo — nessuna email inviata davvero

`AUTH_DEV_MODE=true` in `.env.local`: il link di accesso viene mostrato a
schermo dopo la richiesta invece che spedito via email (nessun provider email
configurato ancora). **Prima del deployment (step 5) va rimosso** e collegato
un vero invio (Resend, SMTP...) in `src/lib/actions/auth.ts` — cercare il
`TODO(step 5 - deployment)` lì dentro.

### Bug reale trovato e corretto durante il test di questo step

Il cookie di sessione veniva impostato con `cookies()` di `next/headers`
dentro la Route Handler di verifica, ma la risposta restituita era un
`NextResponse.redirect(...)` costruito a mano: i due non si sincronizzano
automaticamente in una Route Handler (a differenza di Server Component/Action,
dove `cookies()` gestisce la risposta implicita). Il sintomo: il login
sembrava funzionare (redirect a `/`) ma la sessione non veniva davvero
salvata. Corretto impostando il cookie direttamente sull'oggetto risposta
(`response.cookies.set(...)`) — vedi il commento in `src/app/auth/verify/route.ts`.
Scoperto testando via HTTP reale, non dalla lettura del codice.
