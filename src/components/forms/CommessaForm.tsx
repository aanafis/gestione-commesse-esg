"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createCommessa, type CommessaFormState } from "@/lib/actions/commessa";
import { Field, Select, TextInput } from "@/components/forms/Field";
import { COMMESSA_STATUS_LABELS } from "@/lib/labels";

const INITIAL_STATE: CommessaFormState = { status: "idle" };

export function CommessaForm({
  clients,
  suggestedCode,
}: {
  clients: { id: string; name: string }[];
  suggestedCode: string;
}) {
  // Chiave di remount: "Crea un'altra commessa" (sotto) deve rimettere la
  // maschera a nuovo. Un <Link> verso /commesse/nuova non naviga quando
  // l'URL corrente è già quello (caso frequente: il link "+ Nuova commessa"
  // in navbar non ha query string) — bug reale riscontrato dall'utente per
  // la stessa ragione su AssignmentForm. router.refresh() rilegge anche il
  // prossimo codice suggerito e l'elenco clienti aggiornati dal server.
  const [remountKey, setRemountKey] = useState(0);
  const router = useRouter();

  return (
    <CommessaFormInner
      key={remountKey}
      clients={clients}
      suggestedCode={suggestedCode}
      onCreateAnother={() => {
        router.refresh();
        setRemountKey((k) => k + 1);
      }}
    />
  );
}

function CommessaFormInner({
  clients,
  suggestedCode,
  onCreateAnother,
}: {
  clients: { id: string; name: string }[];
  suggestedCode: string;
  onCreateAnother: () => void;
}) {
  const [state, formAction, pending] = useActionState(createCommessa, INITIAL_STATE);
  const [clientMode, setClientMode] = useState<"existing" | "new">(
    clients.length === 0 ? "new" : "existing"
  );

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6">
        <p className="text-sm text-ink-primary">
          Commessa <strong>{state.createdCode}</strong> creata.
        </p>
        <p className="text-xs text-ink-muted">
          Il prossimo passo naturale è aggiungerci un servizio — la maschera arriva a breve.
        </p>
        {state.geocodeFailed && (
          <p className="text-xs text-status-critical">
            Indirizzo salvato, ma non trovato sulla mappa — verifica che sia scritto per esteso (via, numero,
            città).
          </p>
        )}
        <div className="flex gap-3">
          <button type="button" onClick={onCreateAnother} className="text-sm text-accent hover:underline">
            Crea un&apos;altra commessa
          </button>
          <Link href="/" className="text-sm text-ink-secondary hover:underline">
            Torna al Cruscotto
          </Link>
        </div>
      </div>
    );
  }

  const v = state.values;
  const err = state.errors ?? {};

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6">
      {err._form && (
        <p className="rounded-md border border-status-critical/30 bg-status-critical/10 px-3 py-2 text-sm text-status-critical">
          {err._form}
        </p>
      )}

      <Field label="Codice commessa" htmlFor="code" error={err.code} hint="Formato AA-NNN, es. 26-017">
        <TextInput id="code" name="code" defaultValue={v?.code ?? suggestedCode} required />
      </Field>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <legend className="px-1 text-sm font-medium text-ink-primary">Cliente</legend>

        {clients.length > 0 && (
          <div className="flex gap-4 text-sm text-ink-secondary">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="clientMode"
                value="existing"
                checked={clientMode === "existing"}
                onChange={() => setClientMode("existing")}
              />
              Cliente esistente
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="clientMode"
                value="new"
                checked={clientMode === "new"}
                onChange={() => setClientMode("new")}
              />
              Nuovo cliente
            </label>
          </div>
        )}
        {clients.length === 0 && <input type="hidden" name="clientMode" value="new" />}

        {clientMode === "existing" ? (
          <Field label="Cliente" htmlFor="clientId" error={err.clientId}>
            <Select id="clientId" name="clientId" defaultValue={v?.clientId ?? ""}>
              <option value="">Seleziona…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <>
            <Field label="Nome cliente" htmlFor="newClientName" error={err.newClientName}>
              <TextInput id="newClientName" name="newClientName" defaultValue={v?.newClientName ?? ""} />
            </Field>
            <Field label="P.IVA" htmlFor="newClientVat" error={err.newClientVat} hint="Facoltativa">
              <TextInput id="newClientVat" name="newClientVat" defaultValue={v?.newClientVat ?? ""} />
            </Field>
          </>
        )}
      </fieldset>

      <Field label="Asset / edificio" htmlFor="assetName" error={err.assetName} hint="Facoltativo">
        <TextInput id="assetName" name="assetName" defaultValue={v?.assetName ?? ""} />
      </Field>

      <Field
        label="Indirizzo"
        htmlFor="address"
        error={err.address}
        hint="Facoltativo — usato per localizzare l'asset sulla mappa (geocodifica automatica via OpenStreetMap)"
      >
        <TextInput id="address" name="address" defaultValue={v?.address ?? ""} placeholder="Via, numero civico, città" />
      </Field>

      <Field label="Referente cliente" htmlFor="clientContact" error={err.clientContact} hint="Facoltativo">
        <TextInput id="clientContact" name="clientContact" defaultValue={v?.clientContact ?? ""} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Data avvio" htmlFor="startDate" error={err.startDate} hint="Facoltativa">
          <TextInput type="date" id="startDate" name="startDate" defaultValue={v?.startDate ?? ""} />
        </Field>
        <Field label="Fine prevista" htmlFor="endDate" error={err.endDate} hint="Facoltativa">
          <TextInput type="date" id="endDate" name="endDate" defaultValue={v?.endDate ?? ""} />
        </Field>
      </div>

      <Field label="Stato" htmlFor="status" error={err.status}>
        <Select id="status" name="status" defaultValue={v?.status ?? "active"}>
          {Object.entries(COMMESSA_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Valore contratto (€)"
        htmlFor="contractValue"
        error={err.contractValue}
        hint="Quanto ha firmato il cliente in totale — dovrà coincidere con la somma dei prezzi dei servizi"
      >
        <TextInput
          type="number"
          id="contractValue"
          name="contractValue"
          min="0"
          step="0.01"
          defaultValue={v?.contractValue ?? ""}
          required
        />
      </Field>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Salvataggio…" : "Crea commessa"}
        </button>
      </div>
    </form>
  );
}
