"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateService, type ServiceEditFormState } from "@/lib/actions/service";
import { Field, Select, TextInput } from "@/components/forms/Field";
import { SERVICE_STATUS_LABELS } from "@/lib/labels";

const INITIAL_STATE: ServiceEditFormState = { status: "idle" };

export function ServiceEditForm({
  service,
  serviceTypes,
  people,
}: {
  service: {
    id: string;
    code: string;
    commessaCode: string;
    serviceTypeId: string;
    variant: string | null;
    pmId: string | null;
    startDate: string; // già in formato input-date (YYYY-MM-DD)
    endDate: string;
    status: string;
    consultantCostBudget: string;
    markup: string;
    contractedPrice: string;
  };
  serviceTypes: { id: string; name: string }[];
  people: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(updateService, INITIAL_STATE);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success") router.push(`/servizi/${service.id}`);
  }, [state.status, router, service.id]);

  const v = state.values;
  const err = state.errors ?? {};

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6">
      <input type="hidden" name="id" value={service.id} />

      {err._form && (
        <p className="rounded-md border border-status-critical/30 bg-status-critical/10 px-3 py-2 text-sm text-status-critical">
          {err._form}
        </p>
      )}

      <Field label="Commessa" htmlFor="_commessaCode">
        <TextInput id="_commessaCode" value={service.commessaCode} disabled />
      </Field>

      <Field label="Codice servizio" htmlFor="_code" hint="Non modificabile da qui">
        <TextInput id="_code" value={service.code} disabled />
      </Field>

      <Field label="Tipo di servizio" htmlFor="serviceTypeId" error={err.serviceTypeId}>
        <Select
          id="serviceTypeId"
          name="serviceTypeId"
          defaultValue={v?.serviceTypeId ?? service.serviceTypeId}
        >
          {serviceTypes.map((st) => (
            <option key={st.id} value={st.id}>
              {st.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Variante" htmlFor="variant" error={err.variant} hint="Facoltativa, per casi particolari">
        <TextInput id="variant" name="variant" defaultValue={v?.variant ?? service.variant ?? ""} />
      </Field>

      <Field label="Project manager" htmlFor="pmId" error={err.pmId} hint="Facoltativo">
        <Select id="pmId" name="pmId" defaultValue={v?.pmId ?? service.pmId ?? ""}>
          <option value="">Nessuno</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Data avvio" htmlFor="startDate" error={err.startDate}>
          <TextInput
            type="date"
            id="startDate"
            name="startDate"
            defaultValue={v?.startDate ?? service.startDate}
          />
        </Field>
        <Field label="Fine prevista" htmlFor="endDate" error={err.endDate} hint="Facoltativa">
          <TextInput type="date" id="endDate" name="endDate" defaultValue={v?.endDate ?? service.endDate} />
        </Field>
      </div>

      <Field label="Stato" htmlFor="status" error={err.status}>
        <Select id="status" name="status" defaultValue={v?.status ?? service.status}>
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
            defaultValue={v?.consultantCostBudget ?? service.consultantCostBudget}
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
            defaultValue={v?.markup ?? service.markup}
          />
        </Field>

        <Field
          label="Prezzo contrattualizzato (€)"
          htmlFor="contractedPrice"
          error={err.contractedPrice}
          hint="Quanto ha firmato il cliente per questo servizio"
        >
          <TextInput
            type="number"
            id="contractedPrice"
            name="contractedPrice"
            min="0"
            step="0.01"
            defaultValue={v?.contractedPrice ?? service.contractedPrice}
          />
        </Field>
      </fieldset>

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
