"use client";

import { useActionState } from "react";
import { updatePhasePercent, type PhasePercentFormState } from "@/lib/actions/phase";

const INITIAL_STATE: PhasePercentFormState = { status: "idle" };

/** Modifica rapida dell'avanzamento direttamente nella tabella Fasi (§6.5) —
 * un form per riga, senza passare dalla maschera completa. Solo la
 * percentuale: per date/responsabile serve ancora "Aggiorna avanzamento". */
export function PhaseProgressInlineForm({ phaseId, initialPct }: { phaseId: string; initialPct: number }) {
  const action = updatePhasePercent.bind(null, phaseId);
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-col items-end gap-0.5">
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          name="progressPct"
          min="0"
          max="100"
          step="1"
          defaultValue={initialPct}
          className="w-14 rounded border border-border bg-surface px-1.5 py-0.5 text-right text-sm text-ink-primary outline-none focus:border-accent"
        />
        <span className="text-ink-secondary">%</span>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-accent px-2 py-0.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {pending ? "…" : "Salva"}
        </button>
      </div>
      {state.status === "error" && <span className="text-xs text-status-critical">{state.error}</span>}
    </form>
  );
}
