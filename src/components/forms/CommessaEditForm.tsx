"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateCommessa, type CommessaEditFormState } from "@/lib/actions/commessa";
import { Field, Select, TextInput } from "@/components/forms/Field";
import { COMMESSA_STATUS_LABELS } from "@/lib/labels";

const INITIAL_STATE: CommessaEditFormState = { status: "idle" };

export function CommessaEditForm({
  commessa,
  clients,
}: {
  commessa: {
    id: string;
    code: string;
    clientId: string;
    assetName: string | null;
    address: string | null;
    clientContact: string | null;
    startDate: string; // già in formato input-date (YYYY-MM-DD)
    endDate: string;
    status: string;
    contractValue: string;
  };
  clients: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(updateCommessa, INITIAL_STATE);
  const router = useRouter();

  useEffect(() => {
    // Se l'indirizzo non è stato trovato dalla geocodifica, resta un attimo
    // sulla pagina per mostrare l'avviso invece di sparire subito con lo
    // stesso redirect immediato degli altri salvataggi riusciti.
    if (state.status === "success" && !state.geocodeFailed) router.push("/commesse");
  }, [state.status, state.geocodeFailed, router]);

  if (state.status === "success" && state.geocodeFailed) {
    return (
      <div className="flex max-w-2xl flex-col gap-4 rounded-lg border border-border bg-surface p-6">
        <p className="text-sm text-ink-primary">Commessa aggiornata.</p>
        <p className="text-sm text-status-critical">
          Indirizzo salvato, ma non trovato sulla mappa — verifica che sia scritto per esteso (via, numero,
          città) e correggilo se serve.
        </p>
        <button
          type="button"
          onClick={() => router.push("/commesse")}
          className="self-start text-sm text-accent hover:underline"
        >
          Torna alle commesse
        </button>
      </div>
    );
  }

  const v = state.values;
  const err = state.errors ?? {};

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6">
      <input type="hidden" name="id" value={commessa.id} />

      {err._form && (
        <p className="rounded-md border border-status-critical/30 bg-status-critical/10 px-3 py-2 text-sm text-status-critical">
          {err._form}
        </p>
      )}

      <Field label="Codice commessa" htmlFor="_code" hint="Non modificabile da qui — i codici servizio ne dipendono">
        <TextInput id="_code" value={commessa.code} disabled />
      </Field>

      <Field label="Cliente" htmlFor="clientId" error={err.clientId}>
        <Select id="clientId" name="clientId" defaultValue={v?.clientId ?? commessa.clientId}>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Asset / edificio" htmlFor="assetName" error={err.assetName} hint="Facoltativo">
        <TextInput id="assetName" name="assetName" defaultValue={v?.assetName ?? commessa.assetName ?? ""} />
      </Field>

      <Field
        label="Indirizzo"
        htmlFor="address"
        error={err.address}
        hint="Facoltativo — usato per localizzare l'asset sulla mappa (geocodifica automatica via OpenStreetMap)"
      >
        <TextInput
          id="address"
          name="address"
          defaultValue={v?.address ?? commessa.address ?? ""}
          placeholder="Via, numero civico, città"
        />
      </Field>

      <Field label="Referente cliente" htmlFor="clientContact" error={err.clientContact} hint="Facoltativo">
        <TextInput
          id="clientContact"
          name="clientContact"
          defaultValue={v?.clientContact ?? commessa.clientContact ?? ""}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Data avvio" htmlFor="startDate" error={err.startDate} hint="Facoltativa">
          <TextInput type="date" id="startDate" name="startDate" defaultValue={v?.startDate ?? commessa.startDate} />
        </Field>
        <Field label="Fine prevista" htmlFor="endDate" error={err.endDate} hint="Facoltativa">
          <TextInput type="date" id="endDate" name="endDate" defaultValue={v?.endDate ?? commessa.endDate} />
        </Field>
      </div>

      <Field label="Stato" htmlFor="status" error={err.status}>
        <Select id="status" name="status" defaultValue={v?.status ?? commessa.status}>
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
        hint="Dovrà coincidere con la somma dei prezzi dei servizi (quadratura, §5)"
      >
        <TextInput
          type="number"
          id="contractValue"
          name="contractValue"
          min="0"
          step="0.01"
          defaultValue={v?.contractValue ?? commessa.contractValue}
        />
      </Field>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Salvataggio…" : "Salva modifiche"}
        </button>
      </div>
    </form>
  );
}
