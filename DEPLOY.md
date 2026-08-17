# Deployment — Vercel

## 1. Codice su GitHub

Repository: `https://github.com/aanafis/gestione-commesse-esg`. Il remote è
già configurato in locale (`git remote -v`); pubblicalo con GitHub Desktop
(*Add existing repository* → `C:\Progetti\gestione-commesse` → *Publish*/
*Push origin*) o con `git push -u origin main` da un terminale dove sei già
autenticato con GitHub.

## 2. Importa il progetto in Vercel

1. Su [vercel.com](https://vercel.com), *Add New* → *Project* → seleziona
   `aanafis/gestione-commesse-esg` (serve autorizzare Vercel ad accedere al
   repository la prima volta).
2. Vercel riconosce Next.js da solo — non serve toccare i comandi di build.
3. **Regione**: nelle impostazioni del progetto, imposta la regione delle
   funzioni su **Frankfurt (fra1)** — coerente con Neon, già in UE, e con la
   sensibilità dei dati (tariffe orarie interne, §7 della spec).
4. Prima del primo deploy, incolla le variabili d'ambiente sotto
   (*Settings → Environment Variables*, ambiente **Production**).

## 3. Variabili d'ambiente (Production)

| Nome | Valore | Note |
|---|---|---|
| `DATABASE_URL` | quello già in `.env.local` | stesso database Neon usato in sviluppo — a questa scala (4 persone) non serve un database di produzione separato |
| `AUTH_SECRET` | `ZGCUbmTLY79DZXQvm3M8COULKcCvuNhP8jc6+5oNtIc=` | **diverso** da quello di sviluppo — generato apposta, non riusare quello in `.env.local` |
| `AUTH_DEV_MODE` | *(non impostarla)* | in sviluppo vale `true`; in produzione va **assente**, altrimenti i magic link non vengono mai spediti davvero |
| `RESEND_API_KEY` | la tua API key Resend | da resend.com → API Keys |
| `EMAIL_FROM` | *(facoltativa)* | di default invia da `onboarding@resend.dev` (funziona subito). Per inviare da `@ilprisma.com` serve prima verificare il dominio su Resend (record DNS), poi impostare qui es. `Gestione Commesse ESG <no-reply@ilprisma.com>` |

`APP_URL` non serve impostarla: Vercel fornisce da solo il dominio di
produzione (`VERCEL_PROJECT_PRODUCTION_URL`), usato per costruire il link
nell'email. Impostala solo se in futuro colleghi un dominio personalizzato
diverso da quello assegnato da Vercel.

## 4. Dopo il primo deploy

- Prova subito il login reale: vai su `/login` con la tua email
  `@ilprisma.com`, controlla che l'email arrivi (controlla anche lo spam —
  è normale finché il dominio mittente non è verificato).
- Verifica che HTTPS sia attivo (Vercel lo fa da solo — obbligatorio per
  §7 della spec).
- Tieni il file Excel in uso in parallelo per un ciclo mensile completo
  prima di considerarlo l'unico sistema (§13 della spec).

## 5. Aggiornamenti successivi

Con Vercel collegato al repository GitHub, ogni push su `main` pubblica da
solo una nuova versione — non serve ripetere questi passaggi. Se cambi lo
schema del database, applica prima la migration su Neon (`db/README.md`),
poi pusha il codice che la usa.
