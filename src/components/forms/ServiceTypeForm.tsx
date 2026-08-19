"use client";

import { useActionState } from "react";
import Link from "next/link";
import { saveServiceType, type ServiceTypeFormState } from "@/lib/actions/service-type";
import { Field, Select, TextInput } from "@/components/forms/Field";

const INITIAL_STATE: ServiceTypeFormState = { status: "idle" };

export function ServiceTypeForm({
  serviceType,
}: {
  serviceType?: { id: string; name: string; sortOrder: number; active: boolean };
}) {
  const [state, formAction, pending] = useActionState(saveServiceType, INITIAL_STATE);

  const v = state.values;
  const err = state.errors ?? {};

  // A differenza delle altre maschere Admin, dopo un salvataggio riuscito
  // non si torna subito alla lista: creare un Tipo di servizio ha spesso
  // un passo successivo naturale (definirne le fasi, §4.1) — lo si offre
  // qui invece di nasconderlo in un'altra pagina da scoprire da soli.
  if (state.status === "success") {
    const name = v?.name ?? serviceType?.name ?? "";
    return (
      <div className="flex max-w-md flex-col gap-4 rounded-lg border border-border bg-surface p-6">
        <p className="text-sm text-ink-primary">
          Tipo di servizio <strong>{name}</strong> salvato.
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href={`/admin/template-fasi/fase/nuova?templateName=${encodeURIComponent(name)}`}
            className="text-sm text-accent hover:underline"
          >
            Definisci le fasi per questo tipo di servizio
          </Link>
          <Link href="/admin/tipi-servizio" className="text-sm text-ink-secondary hover:underline">
            Torna ai Tipi di servizio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-6">
      <input type="hidden" name="id" value={serviceType?.id ?? ""} />

      {err._form && <p className="text-sm text-status-critical">{err._form}</p>}

      <Field
        label="Nome"
        htmlFor="name"
        error={err.name}
        hint="Coincide col nome del template fasi, se ne crei uno collegato (es. 'LEED BD+C')"
      >
        <TextInput id="name" name="name" defaultValue={v?.name ?? serviceType?.name ?? ""} />
      </Field>

      <Field label="Ordine" htmlFor="sortOrder" error={err.sortOrder} hint="Posizione nell'elenco a tendina">
        <TextInput
          type="number"
          id="sortOrder"
          name="sortOrder"
          step="10"
          defaultValue={v?.sortOrder ?? String(serviceType?.sortOrder ?? 500)}
        />
      </Field>

      <Field label="Stato" htmlFor="active" error={err.active}>
        <Select id="active" name="active" defaultValue={v?.active ?? String(serviceType?.active ?? true)}>
          <option value="true">Attivo</option>
          <option value="false">Disattivo</option>
        </Select>
      </Field>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Salvataggio…" : "Salva"}
        </button>
      </div>
    </form>
  );
}
