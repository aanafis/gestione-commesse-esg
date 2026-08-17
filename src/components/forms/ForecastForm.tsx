"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createHoursForecast, type ForecastFormState } from "@/lib/actions/forecast";
import { Field, Select, TextInput } from "@/components/forms/Field";
import { formatDate, formatHours, toNumber } from "@/lib/format";

const INITIAL_STATE: ForecastFormState = { status: "idle" };

type Pair = {
  serviceId: string;
  personId: string;
  serviceCode: string;
  commessaCode: string;
  personName: string;
  estimatedHours: string;
  actualHours: string | null;
  current: { etcHours: string; quarter: string; recordedAt: Date | string } | null;
};

export function ForecastForm({
  pairs,
  quarterOptions,
  defaultQuarter,
}: {
  pairs: Pair[];
  quarterOptions: string[];
  defaultQuarter: string;
}) {
  const [state, formAction, pending] = useActionState(createHoursForecast, INITIAL_STATE);

  const initialKey = pairs.length > 0 ? `${pairs[0].serviceId}:${pairs[0].personId}` : "";
  const [pairKey, setPairKey] = useState(initialKey);
  const selected = pairs.find((p) => `${p.serviceId}:${p.personId}` === pairKey);

  const estimated = toNumber(selected?.estimatedHours) ?? 0;
  const actual = toNumber(selected?.actualHours) ?? 0;
  const suggestion = Math.max(0, estimated - actual);

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6">
        <p className="text-sm text-ink-primary">Previsione registrata.</p>
        <div className="flex gap-3">
          <Link href={`/servizi/${state.createdServiceId}`} className="text-sm text-accent hover:underline">
            Vai alla scheda servizio
          </Link>
          <Link href="/previsioni/nuova" className="text-sm text-ink-secondary hover:underline">
            Registra un&apos;altra previsione
          </Link>
        </div>
      </div>
    );
  }

  const err = state.errors ?? {};

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-6">
      {err._form && (
        <p className="rounded-md border border-status-critical/30 bg-status-critical/10 px-3 py-2 text-sm text-status-critical">
          {err._form}
        </p>
      )}

      <Field label="Servizio / persona" htmlFor="pair" error={err.serviceId}>
        <Select id="pair" value={pairKey} onChange={(e) => setPairKey(e.target.value)}>
          {pairs.map((p) => (
            <option key={`${p.serviceId}:${p.personId}`} value={`${p.serviceId}:${p.personId}`}>
              {p.serviceCode} ({p.commessaCode}) — {p.personName}
            </option>
          ))}
        </Select>
        <input type="hidden" name="serviceId" value={selected?.serviceId ?? ""} />
        <input type="hidden" name="personId" value={selected?.personId ?? ""} />
      </Field>

      {selected && (
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4 text-sm text-ink-secondary">
          <div className="flex justify-between">
            <span>Ore stimate</span>
            <span>{formatHours(selected.estimatedHours)}</span>
          </div>
          <div className="flex justify-between">
            <span>Ore consuntivo</span>
            <span>{formatHours(selected.actualHours)}</span>
          </div>
          {selected.current ? (
            <div className="flex justify-between">
              <span>Previsione corrente ({selected.current.quarter})</span>
              <span>
                {formatHours(selected.current.etcHours)} — registrata il {formatDate(selected.current.recordedAt)}
              </span>
            </div>
          ) : (
            <div className="text-ink-muted">Nessuna previsione corrente per questa coppia.</div>
          )}
        </div>
      )}

      <Field label="Trimestre" htmlFor="quarter" error={err.quarter}>
        <Select id="quarter" name="quarter" defaultValue={state.values?.quarter ?? defaultQuarter}>
          {quarterOptions.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="ETC — ore ancora necessarie da oggi"
        htmlFor="etcHours"
        error={err.etcHours}
        hint={`Suggerimento (non precompilato — §3): MAX(0, stimate − consuntivo) = ${formatHours(suggestion)}. Guarda lo stato reale del lavoro, non solo il budget residuo.`}
      >
        <TextInput type="number" id="etcHours" name="etcHours" min="0" step="0.5" defaultValue={state.values?.etcHours ?? ""} />
      </Field>

      <Field label="Note" htmlFor="notes" error={err.notes} hint="Facoltative — perché questa stima, cosa è cambiato">
        <TextInput id="notes" name="notes" defaultValue={state.values?.notes ?? ""} />
      </Field>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Salvataggio…" : "Registra previsione"}
        </button>
      </div>
    </form>
  );
}
