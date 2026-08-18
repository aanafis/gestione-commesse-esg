"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateAssignment, type AssignmentEditFormState } from "@/lib/actions/assignment";
import { Field, Select, TextInput } from "@/components/forms/Field";
import { PROJECT_ROLE_LABELS } from "@/lib/labels";

const INITIAL_STATE: AssignmentEditFormState = { status: "idle" };

export function AssignmentEditForm({
  assignment,
}: {
  assignment: {
    id: string;
    serviceId: string;
    serviceCode: string;
    commessaCode: string;
    personName: string;
    levelName: string;
    projectRole: string;
    estimatedHours: string;
  };
}) {
  const [state, formAction, pending] = useActionState(updateAssignment, INITIAL_STATE);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success") router.push(`/servizi/${state.serviceId ?? assignment.serviceId}`);
  }, [state.status, state.serviceId, router, assignment.serviceId]);

  const v = state.values;
  const err = state.errors ?? {};

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-6">
      <input type="hidden" name="id" value={assignment.id} />

      {err._form && (
        <p className="rounded-md border border-status-critical/30 bg-status-critical/10 px-3 py-2 text-sm text-status-critical">
          {err._form}
        </p>
      )}

      <Field label="Servizio" htmlFor="_service">
        <TextInput id="_service" value={`${assignment.serviceCode} (${assignment.commessaCode})`} disabled />
      </Field>

      <Field label="Persona" htmlFor="_person" hint="Non modificabile da qui">
        <TextInput id="_person" value={`${assignment.personName} (${assignment.levelName})`} disabled />
      </Field>

      <Field label="Ruolo" htmlFor="projectRole" error={err.projectRole}>
        <Select id="projectRole" name="projectRole" defaultValue={v?.projectRole ?? assignment.projectRole}>
          {Object.entries(PROJECT_ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Ore stimate"
        htmlFor="estimatedHours"
        error={err.estimatedHours}
        hint="Base del prezzo (§2) — non del consuntivo"
      >
        <TextInput
          type="number"
          id="estimatedHours"
          name="estimatedHours"
          min="0"
          step="0.5"
          defaultValue={v?.estimatedHours ?? assignment.estimatedHours}
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
