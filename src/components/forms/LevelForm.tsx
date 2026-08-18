"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { saveLevel, type LevelFormState } from "@/lib/actions/level";
import { Field, Select, TextInput } from "@/components/forms/Field";

const INITIAL_STATE: LevelFormState = { status: "idle" };

export function LevelForm({
  level,
}: {
  level?: { id: string; name: string; internalCostRate: string; soldRate: string; active: boolean };
}) {
  const [state, formAction, pending] = useActionState(saveLevel, INITIAL_STATE);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success") router.push("/admin/livelli");
  }, [state.status, router]);

  const v = state.values;
  const err = state.errors ?? {};

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-6">
      <input type="hidden" name="id" value={level?.id ?? ""} />

      {err._form && (
        <p className="rounded-md border border-status-critical/30 bg-status-critical/10 px-3 py-2 text-sm text-status-critical">
          {err._form}
        </p>
      )}

      <Field label="Nome livello" htmlFor="name" error={err.name}>
        <TextInput id="name" name="name" defaultValue={v?.name ?? level?.name ?? ""} />
      </Field>

      <Field label="Costo interno (€/h)" htmlFor="internalCostRate" error={err.internalCostRate}>
        <TextInput
          type="number"
          id="internalCostRate"
          name="internalCostRate"
          min="0"
          step="0.01"
          defaultValue={v?.internalCostRate ?? level?.internalCostRate ?? ""}
        />
      </Field>

      <Field
        label="Tariffa venduta (€/h)"
        htmlFor="soldRate"
        error={err.soldRate}
        hint="Cambiare qui non altera le assegnazioni già create — solo le prossime"
      >
        <TextInput type="number" id="soldRate" name="soldRate" min="0" step="0.01" defaultValue={v?.soldRate ?? level?.soldRate ?? ""} />
      </Field>

      <Field label="Stato" htmlFor="active" error={err.active}>
        <Select id="active" name="active" defaultValue={v?.active ?? String(level?.active ?? true)}>
          <option value="true">Attivo</option>
          <option value="false">Disattivo</option>
        </Select>
      </Field>

      <div>
        <button type="submit" disabled={pending} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {pending ? "Salvataggio…" : "Salva"}
        </button>
      </div>
    </form>
  );
}
