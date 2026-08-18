"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { savePerson, type PersonFormState } from "@/lib/actions/person";
import { Field, Select, TextInput } from "@/components/forms/Field";
import { PERSON_ROLE_LABELS } from "@/lib/labels";

const INITIAL_STATE: PersonFormState = { status: "idle" };

export function PersonForm({
  person,
  levels,
  isSelf,
}: {
  person?: {
    id: string;
    name: string;
    email: string;
    levelId: string | null;
    role: string;
    active: boolean;
    annualAvailableHours: string;
  };
  levels: { id: string; name: string }[];
  isSelf: boolean;
}) {
  const [state, formAction, pending] = useActionState(savePerson, INITIAL_STATE);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success") router.push("/admin/persone");
  }, [state.status, router]);

  const v = state.values;
  const err = state.errors ?? {};

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-6">
      <input type="hidden" name="id" value={person?.id ?? ""} />

      {err._form && (
        <p className="rounded-md border border-status-critical/30 bg-status-critical/10 px-3 py-2 text-sm text-status-critical">
          {err._form}
        </p>
      )}

      <Field label="Nome" htmlFor="name" error={err.name}>
        <TextInput id="name" name="name" defaultValue={v?.name ?? person?.name ?? ""} />
      </Field>

      <Field label="Email" htmlFor="email" error={err.email} hint="È anche l'indirizzo con cui accede (magic link)">
        <TextInput type="email" id="email" name="email" defaultValue={v?.email ?? person?.email ?? ""} />
      </Field>

      <Field label="Livello" htmlFor="levelId" error={err.levelId}>
        <Select id="levelId" name="levelId" defaultValue={v?.levelId ?? person?.levelId ?? ""}>
          <option value="">Seleziona…</option>
          {levels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Ore disponibili/anno" htmlFor="annualAvailableHours" error={err.annualAvailableHours}>
        <TextInput
          type="number"
          id="annualAvailableHours"
          name="annualAvailableHours"
          min="0"
          step="1"
          defaultValue={v?.annualAvailableHours ?? person?.annualAvailableHours ?? "1600"}
        />
      </Field>

      <Field label="Ruolo" htmlFor="role" error={err.role} hint={isSelf ? "Non puoi cambiare il tuo stesso ruolo da qui" : undefined}>
        <Select id="role" name="role" defaultValue={v?.role ?? person?.role ?? "member"} disabled={isSelf}>
          {Object.entries(PERSON_ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        {isSelf && <input type="hidden" name="role" value={person?.role} />}
      </Field>

      <Field label="Stato" htmlFor="active" error={err.active} hint={isSelf ? "Non puoi disattivare il tuo stesso account" : undefined}>
        <Select id="active" name="active" defaultValue={v?.active ?? String(person?.active ?? true)} disabled={isSelf}>
          <option value="true">Attivo</option>
          <option value="false">Disattivo</option>
        </Select>
        {isSelf && <input type="hidden" name="active" value="true" />}
      </Field>

      <div>
        <button type="submit" disabled={pending} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {pending ? "Salvataggio…" : "Salva"}
        </button>
      </div>
    </form>
  );
}
