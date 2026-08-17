"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createService, type ServiceFormState } from "@/lib/actions/service";
import { Field, Select, TextInput } from "@/components/forms/Field";
import { SERVICE_STATUS_LABELS } from "@/lib/labels";

const INITIAL_STATE: ServiceFormState = { status: "idle" };
const NO_TEMPLATE = "";

export function ServiceForm({
  commesse,
  serviceTypes,
  templateNames,
  people,
  defaultMarkup,
  initialCommessaId,
}: {
  commesse: { id: string; code: string; nextServiceCode: string }[];
  serviceTypes: { id: string; name: string }[];
  templateNames: string[];
  people: { id: string; name: string }[];
  defaultMarkup: string;
  initialCommessaId?: string;
}) {
  const [state, formAction, pending] = useActionState(createService, INITIAL_STATE);

  const startCommessaId = state.values?.commessaId || initialCommessaId || commesse[0]?.id || "";
  const [commessaId, setCommessaId] = useState(startCommessaId);
  const [code, setCode] = useState(
    state.values?.code ?? commesse.find((c) => c.id === startCommessaId)?.nextServiceCode ?? ""
  );
  const [serviceTypeId, setServiceTypeId] = useState(state.values?.serviceTypeId ?? "");
  const [templateName, setTemplateName] = useState(state.values?.templateName ?? NO_TEMPLATE);

  function onCommessaChange(id: string) {
    setCommessaId(id);
    const next = commesse.find((c) => c.id === id)?.nextServiceCode;
    if (next) setCode(next);
  }

  function onServiceTypeChange(id: string) {
    setServiceTypeId(id);
    const name = serviceTypes.find((st) => st.id === id)?.name;
    if (name && templateNames.includes(name)) setTemplateName(name);
  }

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6">
        <p className="text-sm text-ink-primary">
          Servizio <strong>{state.createdCode}</strong> creato
          {state.generatedPhasesCount ? (
            <> — {state.generatedPhasesCount} fasi generate dal template</>
          ) : (
            <> — nessuna fase generata (nessun template scelto)</>
          )}
          .
        </p>
        <div className="flex gap-3">
          <Link href={`/servizi/${state.createdId}`} className="text-sm text-accent hover:underline">
            Vai alla scheda servizio
          </Link>
          <Link href="/servizi/nuovo" className="text-sm text-ink-secondary hover:underline">
            Crea un altro servizio
          </Link>
        </div>
      </div>
    );
  }

  const err = state.errors ?? {};

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6">
      {err._form && (
        <p className="rounded-md border border-status-critical/30 bg-status-critical/10 px-3 py-2 text-sm text-status-critical">
          {err._form}
        </p>
      )}

      <Field label="Commessa" htmlFor="commessaId" error={err.commessaId}>
        <Select
          id="commessaId"
          name="commessaId"
          value={commessaId}
          onChange={(e) => onCommessaChange(e.target.value)}
        >
          <option value="">Seleziona…</option>
          {commesse.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Codice servizio" htmlFor="code" error={err.code} hint="Formato {commessa}-{lettera}, es. 26-017-A">
        <TextInput id="code" name="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
      </Field>

      <Field label="Tipo di servizio" htmlFor="serviceTypeId" error={err.serviceTypeId}>
        <Select
          id="serviceTypeId"
          name="serviceTypeId"
          value={serviceTypeId}
          onChange={(e) => onServiceTypeChange(e.target.value)}
        >
          <option value="">Seleziona…</option>
          {serviceTypes.map((st) => (
            <option key={st.id} value={st.id}>
              {st.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Variante" htmlFor="variant" error={err.variant} hint="Facoltativa, per casi particolari">
        <TextInput id="variant" name="variant" defaultValue={state.values?.variant ?? ""} />
      </Field>

      <Field
        label="Template fasi"
        htmlFor="templateName"
        error={err.templateName}
        hint="Genera automaticamente le fasi dal template, con le date a cascata dall'avvio"
      >
        <Select id="templateName" name="templateName" value={templateName} onChange={(e) => setTemplateName(e.target.value)}>
          <option value={NO_TEMPLATE}>Nessuno (nessuna fase generata)</option>
          {templateNames.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Project manager" htmlFor="pmId" error={err.pmId} hint="Facoltativo">
        <Select id="pmId" name="pmId" defaultValue={state.values?.pmId ?? ""}>
          <option value="">Nessuno</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Data avvio"
          htmlFor="startDate"
          error={err.startDate}
          hint="Serve per calcolare le date delle fasi generate"
        >
          <TextInput type="date" id="startDate" name="startDate" defaultValue={state.values?.startDate ?? ""} />
        </Field>
        <Field label="Fine prevista" htmlFor="endDate" error={err.endDate} hint="Facoltativa">
          <TextInput type="date" id="endDate" name="endDate" defaultValue={state.values?.endDate ?? ""} />
        </Field>
      </div>

      <Field label="Stato" htmlFor="status" error={err.status}>
        <Select id="status" name="status" defaultValue={state.values?.status ?? "active"}>
          {Object.entries(SERVICE_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      <fieldset className="flex flex-col gap-4 rounded-lg border border-border p-4">
        <legend className="px-1 text-sm font-medium text-ink-primary">
          Prezzo — costruito dal basso (§2)
        </legend>

        <Field
          label="Costo consulenti a budget (€)"
          htmlFor="consultantCostBudget"
          error={err.consultantCostBudget}
          hint="Quanto stimi di spendere in consulenti esterni per questo servizio"
        >
          <TextInput
            type="number"
            id="consultantCostBudget"
            name="consultantCostBudget"
            min="0"
            step="0.01"
            defaultValue={state.values?.consultantCostBudget ?? "0"}
          />
        </Field>

        <Field
          label="Markup"
          htmlFor="markup"
          error={err.markup}
          hint="Moltiplicatore, non percentuale — 1.30 = costo +30%"
        >
          <TextInput
            type="number"
            id="markup"
            name="markup"
            min="0.01"
            step="0.01"
            defaultValue={state.values?.markup ?? defaultMarkup}
          />
        </Field>

        <Field
          label="Prezzo contrattualizzato (€)"
          htmlFor="contractedPrice"
          error={err.contractedPrice}
          hint="Quanto ha firmato il cliente per questo servizio — il prezzo ore si aggiunge assegnando le risorse (prossima maschera)"
        >
          <TextInput
            type="number"
            id="contractedPrice"
            name="contractedPrice"
            min="0"
            step="0.01"
            defaultValue={state.values?.contractedPrice ?? ""}
          />
        </Field>
      </fieldset>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Salvataggio…" : "Crea servizio"}
        </button>
      </div>
    </form>
  );
}
