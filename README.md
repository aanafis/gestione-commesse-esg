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
- [x] 2. Schermate di sola lettura — **Cruscotto** (`/`, ridisegnato a card/grafici — vedi sotto), **Commesse** (`/commesse`, tutte le commesse con quadratura §5), **Servizi** (`/servizi`), **Scheda servizio** (`/servizi/[id]`), **Controllo ore** (`/controllo-ore`), **Mappa progetti** (`/mappa`, un pin per commessa con indirizzo geocodificato). Commesse e Servizi hanno filtri su tutte le colonne (a tendina per le categoriche, ricerca testo per i codici, min/max per le numeriche) ed **export CSV** delle righe filtrate.
- [x] 3. Maschere di inserimento dati — tutte fatte: Nuova commessa, Nuovo servizio, Assegna risorsa, Nuovo ODA, Aggiorna avanzamento fase, Previsione trimestrale, **Import ore da CSV** (`/ore/importa`, mappatura colonne + anteprima + upsert), **Registra ore** (`/ore/nuova`, singola riga a mano — upsert su servizio+persona+mese solo tra righe manuali, non tocca mai le righe da import)
- [x] 4. Autenticazione — magic link (`/login`), sessione JWT nel cookie, `created_by`/`updated_by`/`recorded_by_id` ora valorizzati su tutte le maschere
- [x] 5. Deployment — **https://gestione-commesse-esg.vercel.app**, GitHub → Vercel collegati (push su `main` pubblica da solo)
- [x] Migrazione commessa pilota 26-017 (Adyen) — vedi `db/import-pilot-commessa-26-017.js`, riconciliazione con l'Excel confermata su margine, ore EAC e alert di entrambi i servizi

## Indirizzo asset e mappa progetti (§11)

Ogni commessa può avere un indirizzo (campo libero, maschera Commessa). Al
salvataggio, se l'indirizzo è nuovo o è cambiato, `src/lib/geocode.ts` lo
traduce in coordinate via **Nominatim (OpenStreetMap)** — gratuito, nessuna
chiave API né fatturazione da configurare (scelta esplicita dell'utente al
posto di Google Maps). Se l'indirizzo non viene trovato, si salva comunque
il testo ma senza coordinate: la maschera lo segnala, il resto del
salvataggio non si blocca mai per questo.

`/mappa` mostra un pin per ogni commessa con coordinate — libreria
**Leaflet** usata "a mano" (`src/components/ProjectsMap.tsx`), non il
wrapper `react-leaflet`: evita le sottigliezze SSR/hydration attorno a una
libreria che richiede `window`, e i marker sono cerchi colorati disegnati
inline invece dei pin di default di Leaflet (i cui percorsi immagine non si
risolvono bene con il bundler di Next.js/Turbopack).

## Cruscotto — impaginazione a card (§6.1)

Richiesta dall'utente ("un po' asettico"): stessi dati e stessa palette di
prima (nessun colore nuovo, nessuna vista/query nuova — solo come vengono
mostrati), riorganizzati in card con ombra (`.card-shadow` in globals.css),
azioni rapide in alto, e due grafici a barre orizzontali al posto di lunghe
liste di numeri: margine per tipo di servizio (colorato sulla stessa soglia
di `v_service_alert`, §5: sotto 10% = critico) e utilizzo squadra. Le barre
gestiscono anche valori negativi (una barra che cresce a sinistra dello
zero, non troncata a 0) — necessario perché un margine può essere negativo.

Componenti in `src/components/dashboard/` — distinti da `Card`/`StatTile`
già usati altrove (Scheda servizio), non li sostituiscono: il resto
dell'app resta con il proprio look finché non verrà chiesto altrettanto lì.

Prima di toccare il codice, la nuova impaginazione è stata approvata come
mockup HTML statico (stessi token colore, dati reali) — utile per iterare
velocemente su un cambio visivo prima di portarlo nell'app vera.

## Controllo ore — riepilogo per commessa + una riga per persona (§6.4)

Richiesto dall'utente: una tabella "Per commessa" prima di "Per servizio"
(v_commessa_hours_metrics, nuova vista — somma dei servizi non chiusi,
avanzamento % come media pesata sulle ore stimate, non una media delle
medie); e "Per persona" con **una riga per persona** invece che una per
assegnazione (chi ha 3 servizi non compariva 3 volte) — click sulla riga
per espanderla e vedere le stesse ore suddivise per commessa e per
servizio (`PersonHoursTable.tsx`, client component: l'espansione è
interattiva, niente di nuovo dal database). Il "peggior alert" della persona (per gravità — `severityOf()`, la stessa
mappatura già usata per colorare gli AlertChip ovunque nell'app) resta
visibile sulla riga di riepilogo.

## Modifica ODA — aggiungere un servizio a un ordine esistente

Richiesta dall'utente: un ordine può coprire più servizi (es. LEED e CRREM
sullo stesso numero), ma non c'era modo di aggiungerne uno a un ordine già
creato — solo "Nuovo ODA". Provare a "ricreare" lo stesso numero falliva
sul vincolo UNIQUE (di proposito: un numero ordine identifica un solo
documento). `/oda/[id]/modifica` (link "Modifica" nelle tabelle ODA di
Scheda servizio e Scheda fornitore) risolve aggiungendo/modificando le
**righe** dell'ordine esistente:

- Le righe si sincronizzano per differenza al salvataggio: quelle con un id
  vengono aggiornate, quelle senza sono nuove, quelle rimosse dal form
  vengono cancellate — a meno che abbiano già del fatturato registrato
  (`invoicedAmount > 0`): quello è un evento fiscale reale, la cancellazione
  viene rifiutata invece di procedere silenziosamente.
- Il messaggio d'errore su numero duplicato ora indica esplicitamente di
  aprire l'ordine esistente invece di crearne uno nuovo.

## PDF dell'ODA

Richiesta dall'utente: salvare il PDF dell'ordine di acquisto emesso.
Salvato come `bytea` in Postgres (colonne `pdf_data`/`pdf_filename`/
`pdf_uploaded_at`/`pdf_uploaded_by` su `purchase_order`) — non su uno
storage esterno (Vercel Blob, S3...): zero servizi/chiavi nuove da
configurare, stessa scelta di semplicità già fatta altrove (OpenStreetMap
invece di Google Maps, CSV invece di xlsx). Un file per **ordine**, non per
riga: un ordine può coprire più servizi (§4.2) ma è un solo documento
firmato — lo stesso controllo compare identico su ogni riga dello stesso
ordine (`PurchaseOrderPdfControl`, sia nel tab ODA della Scheda servizio
sia nella Scheda fornitore).

Il download passa da una **Route Handler** (`/oda/[id]/pdf`), non da una
Server Action: serve restituire bytes grezzi con `Content-Type`/
`Content-Disposition`, cosa che un'azione non può fare — stessa sessione
controllata con `getSession()`, nessun accesso anonimo al PDF.

Limite Server Action alzato da 1MB (default Next.js) a 10MB in
`next.config.ts` per accettare l'upload — l'azione stessa rifiuta file
oltre 8MB, con un margine sotto il limite per l'overhead di
multipart/form-data.

## Admin (§6.6)

`/admin` — riservato al ruolo `admin` (verificato sia dal layout che da ogni
Server Action, non solo dal link nascosto in header): Livelli e tariffe,
Persone (livello/ruolo/accesso al login), Clienti, **Fornitori** (il
codice in elenco apre la **Scheda fornitore** — commesse/servizi coinvolti,
ordini di acquisto e stato pagamenti raggruppati per consulente esterno,
richiesta dall'utente; "Modifica anagrafica" resta una pagina separata,
come per il Servizio; "+ Collega un servizio" apre "Nuovo ODA" con questo
fornitore già preselezionato — collegare un servizio a un fornitore, come
richiesto dall'utente, è semplicemente registrare un ODA tra i due; ogni
riga ODA ha anche un controllo per caricare/sostituire/scaricare il PDF
dell'ordine emesso — vedi "PDF dell'ODA" sotto), **Tipi di
servizio** (l'elenco a tendina di "Nuovo servizio" — LEED, WELL, CRREM...
— estendibile in autonomia), Template fasi (con controllo somma quote =
100%; "+ Nuova fase" crea anche un template per un tipo di servizio appena
creato — un template è semplicemente il primo insert con quel nome, nessuna
tabella "template" a parte da popolare prima), Impostazioni (soglie di
approvazione, markup di default). Un admin non può disattivare se stesso né
togliersi il ruolo di amministratore da qui, per non restare tutti fuori per
errore.

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

Modifica e cancellazione (richieste dall'utente dopo il pilota): Servizio
(`/servizi/[id]/modifica`) e Assegnazione (`/assegnazioni/[id]/modifica`)
hanno una maschera dedicata — identità (commessa/codice, persona/servizio)
non modificabile da lì, solo gli attributi. La cancellazione di un servizio
(bottone nella stessa pagina di modifica, dietro conferma) elimina a cascata
tutto ciò che dipende dal servizio (fasi, assegnazioni, ore, previsioni,
righe ODA/SAL non ancora fatturate) — bloccata se esistono SAL già emessi/
incassati o righe ODA già fatturate dal fornitore, eventi fiscali reali che
un DELETE non annullerebbe nella realtà.

## Autenticazione (§7)

Magic link, come raccomandato dalla spec — nessuna password.

- **Flusso**: `/login` → email → `requestMagicLink` crea un token monouso
  (hash SHA-256 in `magic_link_token`, scade in 15 minuti) → `/auth/verify?token=...`
  mostra una pagina di conferma → un click sul bottone "Accedi" (Server
  Action `confirmMagicLink`) scambia il token per una sessione (cookie JWT
  firmato HS256, `src/lib/auth/session.ts`) → redirect a `/`.
- **Perché due passi e non un semplice link cliccabile**: `/auth/verify` era
  prima una Route Handler che consumava il token già alla GET. Bug reale in
  produzione — gli scanner di sicurezza email aziendali (Microsoft Defender/
  Safe Links e simili, comuni con la posta su Microsoft 365 come qui)
  precaricano ogni link nell'email per controllarlo, consumando il token
  prima del click umano: l'utente trovava sempre "invalid_token". Ora la GET
  è di sola lettura (innocua anche se prefetchata quante volte si vuole);
  solo il POST della Server Action, innescato da un vero click, marca il
  token usato e crea la sessione.
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

### Bug reali trovati e corretti dopo il deployment

**1) Cookie di sessione non salvato (trovato in sviluppo).** `/auth/verify`
era allora una Route Handler: il cookie veniva impostato con `cookies()` di
`next/headers`, ma la risposta restituita era un `NextResponse.redirect(...)`
costruito a mano — i due non si sincronizzano automaticamente in una Route
Handler (a differenza di Server Component/Action, dove `cookies()` gestisce
la risposta implicita). Il sintomo: il login sembrava funzionare (redirect a
`/`) ma la sessione non veniva davvero salvata. Corretto allora impostando il
cookie direttamente sull'oggetto risposta (`response.cookies.set(...)`).
Scoperto testando via HTTP reale, non dalla lettura del codice.

**2) Token del magic link consumato prima del click umano (trovato in
produzione).** Quella stessa Route Handler faceva tutto in una GET: leggeva
il token, lo marcava usato, creava la sessione. Un utente reale (email
aziendale su Microsoft 365) riceveva sempre "invalid_token" cliccando un
link appena arrivato. Causa: gli scanner di sicurezza email aziendali
(Safe Links e simili) precaricano ogni link in un'email per controllarlo —
quella GET automatica consumava il token prima che l'utente potesse
cliccarlo davvero. Corretto separando in due passi: `/auth/verify` è ora una
pagina (non più una Route Handler) che fa solo una lettura — innocua anche
se prefetchata quante volte si vuole; solo un vero click sul bottone
"Accedi" (Server Action `confirmMagicLink` in `src/lib/actions/auth.ts`,
invocata via POST) marca il token usato e crea la sessione. Diagnosticato
confrontando `used_at` nella tabella `magic_link_token` (consumato ~10-20s
dopo l'invio, prima del click riferito dall'utente) con un test HTTP che
riproduceva l'intero flusso — non riproducibile dal solo codice, serviva lo
storico reale dei token in produzione.
