"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveClient, type ClientFormState } from "@/lib/actions/client";
import { Field, TextInput } from "@/components/forms/Field";

const INITIAL_STATE: ClientFormState = { status: "idle" };

export function ClientForm({ client }: { client?: { id: string; name: string; vatNumber: string | null; notes: string | null } }) {
  const [state, formAction, pending] = useActionState(saveClient, INITIAL_STATE);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success") router.push("/admin/clienti");
  }, [state.status, router]);

  const v = state.values;
  const err = state.errors ?? {};

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-6">
      <input type="hidden" name="id" value={client?.id ?? ""} />
      {err._form && <p className="text-sm text-status-critical">{err._form}</p>}

      <Field label="Nome" htmlFor="name" error={err.name}>
        <TextInput id="name" name="name" defaultValue={v?.name ?? client?.name ?? ""} />
      </Field>
      <Field label="P.IVA" htmlFor="vatNumber" error={err.vatNumber} hint="Facoltativa">
        <TextInput id="vatNumber" name="vatNumber" defaultValue={v?.vatNumber ?? client?.vatNumber ?? ""} />
      </Field>
      <Field label="Note" htmlFor="notes" error={err.notes} hint="Facoltative">
        <TextInput id="notes" name="notes" defaultValue={v?.notes ?? client?.notes ?? ""} />
      </Field>

      <div>
        <button type="submit" disabled={pending} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {pending ? "Salvataggio…" : "Salva"}
        </button>
      </div>
    </form>
  );
}
