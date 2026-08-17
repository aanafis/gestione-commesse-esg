-- 0008_auth.sql
-- Autenticazione — SPEC.md §7. Magic link: la persona chiede un link,
-- riceve un token monouso a scadenza breve, lo scambia per una sessione.
--
-- Niente tabella "sessioni": la sessione è un cookie firmato (JWT, HS256)
-- verificato dal server senza round-trip al database ad ogni richiesta —
-- è il pattern "stateless session" raccomandato dalla guida Next.js
-- all'autenticazione. Solo il token monouso del link ha bisogno di essere
-- tracciato qui, per poterlo invalidare dopo un solo utilizzo.

BEGIN;

CREATE TABLE magic_link_token (
  id BIGSERIAL PRIMARY KEY,
  person_id BIGINT NOT NULL REFERENCES person(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_magic_link_token_person ON magic_link_token(person_id);

COMMIT;
