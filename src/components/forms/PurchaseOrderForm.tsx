"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createPurchaseOrder,
  type PurchaseOrderFormState,
  type PurchaseOrderLineInput,
} from "@/lib/actions/purchase-order";
import { Field, Select, TextInput } from "@/components/forms/Field";
import { formatMoney, formatMultiplier, toNumber } from "@/lib/format";
import { APPROVAL_LEVEL_LABELS, PO_STATUS_LABELS } from "@/lib/labels";

const INITIAL_STATE: PurchaseOrderFormState = { status: "idle" };

function emptyLine(serviceId = ""): PurchaseOrderLineInput {
  return { serviceId, phaseRef: "", description: "", consultantCost: "", rechargedToClient: "0", invoicedAmount: "0" };
}

export function PurchaseOrderForm({
  suppliers,
  services,
  approvers,
  thresholds,
  initialServiceId,
  initialSupplierId,
}: {
  suppliers: { id: string; code: string; name: string }[];
  services: { id: string; code: string; commessaCode: string }[];
  approvers: { id: string; name: string }[];
  thresholds: { pm: string; director: string };
  initialServiceId?: string;
  initialSupplierId?: string;
}) {
  // Chiave di remount: "Registra un altro ordine" (sotto) non deve dipendere
  // dal cambio di URL — stessa causa già vista su AssignmentForm/CommessaForm/
  // ServiceForm/PhaseProgressForm: React non rimonta questo componente solo
  // perché i props sono cambiati, quindi useActionState restava a "success"
  // per sempre e il click sembrava non fare nulla.
  const [instance, setInstance] = useState({ key: 0, serviceId: initialServiceId, supplierId: initialSupplierId });
  const router = useRouter();

  return (
    <PurchaseOrderFormInner
      key={instance.key}
      suppliers={suppliers}
      services={services}
      approvers={approvers}
      thresholds={thresholds}
      initialServiceId={instance.serviceId}
      initialSupplierId={instance.supplierId}
      onRegisterAnother={(supplierId) => {
        router.refresh();
        setInstance((i) => ({ key: i.key + 1, serviceId: undefined, supplierId }));
      }}
    />
  );
}

function PurchaseOrderFormInner({
  suppliers,
  services,
  approvers,
  thresholds,
  initialServiceId,
  initialSupplierId,
  onRegisterAnother,
}: {
  suppliers: { id: string; code: string; name: string }[];
  services: { id: string; code: string; commessaCode: string }[];
  approvers: { id: string; name: string }[];
  thresholds: { pm: string; director: string };
  initialServiceId?: string;
  initialSupplierId?: string;
  onRegisterAnother: (supplierId: string | undefined) => void;
}) {
  const [state, formAction, pending] = useActionState(createPurchaseOrder, INITIAL_STATE);
  const [lines, setLines] = useState<PurchaseOrderLineInput[]>([emptyLine(initialServiceId)]);

  const linesJson = useMemo(() => JSON.stringify(lines), [lines]);

  const totalConsultantCost = useMemo(
    () => lines.reduce((sum, l) => sum + (toNumber(l.consultantCost) ?? 0), 0),
    [lines]
  );

  const approvalLevel = useMemo(() => {
    const pmThreshold = toNumber(thresholds.pm) ?? 0;
    const directorThreshold = toNumber(thresholds.director) ?? 0;
    if (totalConsultantCost <= pmThreshold) return "autonomous";
    if (totalConsultantCost <= directorThreshold) return "project_manager";
    return "director";
  }, [totalConsultantCost, thresholds]);

  function updateLine(i: number, patch: Partial<PurchaseOrderLineInput>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(i: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6">
        <p className="text-sm text-ink-primary">
          Ordine <strong>{state.createdNumber}</strong> registrato
          {state.approvalLevel && (
            <>
              {" "}
              — approvazione richiesta:{" "}
              <strong>{APPROVAL_LEVEL_LABELS[state.approvalLevel] ?? state.approvalLevel}</strong>
            </>
          )}
          .
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onRegisterAnother(state.createdSupplierId)}
            className="text-sm text-accent hover:underline"
          >
            Registra un altro ordine
          </button>
        </div>
      </div>
    );
  }

  const err = state.errors ?? {};
  const lineErr = err.lines ?? {};

  return (
    <form action={formAction} className="flex max-w-3xl flex-col gap-6">
      {err._form && (
        <p className="rounded-md border border-status-critical/30 bg-status-critical/10 px-3 py-2 text-sm text-status-critical">
          {err._form}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="Numero ordine" htmlFor="number" error={err.number}>
          <TextInput id="number" name="number" defaultValue={state.values?.number ?? ""} />
        </Field>
        <Field label="Fornitore" htmlFor="supplierId" error={err.supplierId}>
          <Select id="supplierId" name="supplierId" defaultValue={state.values?.supplierId ?? initialSupplierId ?? ""}>
            <option value="">Seleziona…</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Descrizione" htmlFor="description" error={err.description} hint="Facoltativa">
        <TextInput id="description" name="description" defaultValue={state.values?.description ?? ""} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Stato" htmlFor="status" error={err.status}>
          <Select id="status" name="status" defaultValue={state.values?.status ?? "requested"}>
            {Object.entries(PO_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Approvatore" htmlFor="approverId" error={err.approverId} hint="Facoltativo">
          <Select id="approverId" name="approverId" defaultValue={state.values?.approverId ?? ""}>
            <option value="">Nessuno</option>
            {approvers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Data emissione" htmlFor="issueDate" error={err.issueDate} hint="Facoltativa">
          <TextInput type="date" id="issueDate" name="issueDate" defaultValue={state.values?.issueDate ?? ""} />
        </Field>
        <Field
          label="Consegna prevista"
          htmlFor="expectedDeliveryDate"
          error={err.expectedDeliveryDate}
          hint="Facoltativa"
        >
          <TextInput
            type="date"
            id="expectedDeliveryDate"
            name="expectedDeliveryDate"
            defaultValue={state.values?.expectedDeliveryDate ?? ""}
          />
        </Field>
      </div>

      <Field label="Note" htmlFor="notes" error={err.notes} hint="Facoltative">
        <TextInput id="notes" name="notes" defaultValue={state.values?.notes ?? ""} />
      </Field>

      <fieldset className="flex flex-col gap-4 rounded-lg border border-border p-4">
        <legend className="px-1 text-sm font-medium text-ink-primary">
          Righe — un ordine può coprire più servizi (§4.2)
        </legend>

        {lines.map((line, i) => {
          const cost = toNumber(line.consultantCost) ?? 0;
          const recharged = toNumber(line.rechargedToClient) ?? 0;
          const markup = cost > 0 ? recharged / cost : null;
          const margin = recharged - cost;
          const e = lineErr[i] ?? {};

          return (
            <div key={i} className="flex flex-col gap-3 rounded-md border border-gridline p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-muted">Riga {i + 1}</span>
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    className="text-xs text-status-critical hover:underline"
                  >
                    Rimuovi
                  </button>
                )}
              </div>

              <Field label="Servizio" htmlFor={`line-${i}-service`} error={e.serviceId}>
                <Select
                  id={`line-${i}-service`}
                  value={line.serviceId}
                  onChange={(ev) => updateLine(i, { serviceId: ev.target.value })}
                >
                  <option value="">Seleziona…</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} ({s.commessaCode})
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Descrizione prestazione" htmlFor={`line-${i}-description`} error={e.description} hint="Facoltativa — es. 'Certificazione LEED', utile quando un ordine copre più servizi">
                <TextInput
                  id={`line-${i}-description`}
                  value={line.description}
                  onChange={(ev) => updateLine(i, { description: ev.target.value })}
                />
              </Field>

              <Field label="Riferimento fase" htmlFor={`line-${i}-phaseRef`} error={e.phaseRef} hint="Testo libero, facoltativo">
                <TextInput
                  id={`line-${i}-phaseRef`}
                  value={line.phaseRef}
                  onChange={(ev) => updateLine(i, { phaseRef: ev.target.value })}
                />
              </Field>

              <div className="grid grid-cols-3 gap-3">
                <Field label="Costo consulente (€)" htmlFor={`line-${i}-cost`} error={e.consultantCost}>
                  <TextInput
                    type="number"
                    id={`line-${i}-cost`}
                    min="0"
                    step="0.01"
                    value={line.consultantCost}
                    onChange={(ev) => updateLine(i, { consultantCost: ev.target.value })}
                  />
                </Field>
                <Field label="Ribaltato al cliente (€)" htmlFor={`line-${i}-recharged`} error={e.rechargedToClient}>
                  <TextInput
                    type="number"
                    id={`line-${i}-recharged`}
                    min="0"
                    step="0.01"
                    value={line.rechargedToClient}
                    onChange={(ev) => updateLine(i, { rechargedToClient: ev.target.value })}
                  />
                </Field>
                <Field label="Fatturato (€)" htmlFor={`line-${i}-invoiced`} error={e.invoicedAmount} hint="Di solito 0 all'inserimento">
                  <TextInput
                    type="number"
                    id={`line-${i}-invoiced`}
                    min="0"
                    step="0.01"
                    value={line.invoicedAmount}
                    onChange={(ev) => updateLine(i, { invoicedAmount: ev.target.value })}
                  />
                </Field>
              </div>

              <p className="text-xs text-ink-muted">
                Markup applicato: {markup === null ? "–" : formatMultiplier(markup)} · Margine riga: {formatMoney(margin)}
              </p>
            </div>
          );
        })}

        <div>
          <button type="button" onClick={addLine} className="text-sm text-accent hover:underline">
            + Aggiungi riga
          </button>
        </div>

        <div className="rounded-md border border-gridline bg-page px-3 py-2 text-sm text-ink-secondary">
          Totale costo consulenti: <strong className="text-ink-primary">{formatMoney(totalConsultantCost)}</strong>
          {" — "}
          approvazione richiesta:{" "}
          <strong className="text-ink-primary">{APPROVAL_LEVEL_LABELS[approvalLevel]}</strong>
        </div>
      </fieldset>

      <input type="hidden" name="linesJson" value={linesJson} />

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Salvataggio…" : "Registra ordine"}
        </button>
      </div>
    </form>
  );
}
