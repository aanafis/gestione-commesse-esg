"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { savePhaseTemplateRow, type PhaseTemplateFormState } from "@/lib/actions/phase-template";
import { Field, Select, TextInput } from "@/components/forms/Field";

const INITIAL_STATE: PhaseTemplateFormState = { status: "idle" };

type PhaseTemplateRow = {
  id: string;
  templateName: string;
  sortOrder: number;
  phaseName: string;
  expectedDeliverable: string | null;
  contractualMilestone: boolean;
  durationDays: number;
  hoursQuotaPct: string;
};

export function PhaseTemplateRowForm({ row }: { row: PhaseTemplateRow }) {
  const [state, formAction, pending] = useActionState(savePhaseTemplateRow, INITIAL_STATE);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success" && state.templateName) {
      router.push(`/admin/template-fasi/${encodeURIComponent(state.templateName)}`);
    }
  }, [state.status, state.templateName, router]);

  const v = state.values;
  const err = state.errors ?? {};

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-6">
      <input type="hidden" name="id" value={row.id} />
      {err._form && <p className="text-sm text-status-critical">{err._form}</p>}

      <p className="text-xs text-ink-muted">Template: {row.templateName}</p>

      <Field label="Nome fase" htmlFor="phaseName" error={err.phaseName}>
        <TextInput id="phaseName" name="phaseName" defaultValue={v?.phaseName ?? row.phaseName} />
      </Field>
      <Field label="Deliverable atteso" htmlFor="expectedDeliverable" error={err.expectedDeliverable} hint="Facoltativo">
        <TextInput id="expectedDeliverable" name="expectedDeliverable" defaultValue={v?.expectedDeliverable ?? row.expectedDeliverable ?? ""} />
      </Field>
      <Field label="Milestone contrattuale" htmlFor="contractualMilestone" error={err.contractualMilestone}>
        <Select id="contractualMilestone" name="contractualMilestone" defaultValue={v?.contractualMilestone ?? String(row.contractualMilestone)}>
          <option value="false">No</option>
          <option value="true">Sì</option>
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Durata (giorni)" htmlFor="durationDays" error={err.durationDays} hint="Offset dalla fase precedente">
          <TextInput type="number" id="durationDays" name="durationDays" min="0" step="1" defaultValue={v?.durationDays ?? String(row.durationDays)} />
        </Field>
        <Field label="Quota ore" htmlFor="hoursQuotaPct" error={err.hoursQuotaPct} hint="Frazione 0-1">
          <TextInput type="number" id="hoursQuotaPct" name="hoursQuotaPct" min="0" max="1" step="0.01" defaultValue={v?.hoursQuotaPct ?? row.hoursQuotaPct} />
        </Field>
      </div>
      <Field label="Ordine" htmlFor="sortOrder" error={err.sortOrder}>
        <TextInput type="number" id="sortOrder" name="sortOrder" min="1" step="1" defaultValue={v?.sortOrder ?? String(row.sortOrder)} />
      </Field>

      <div>
        <button type="submit" disabled={pending} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {pending ? "Salvataggio…" : "Salva"}
        </button>
      </div>
    </form>
  );
}
