"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  updatePurchaseOrder,
  type PurchaseOrderEditFormState,
  type PurchaseOrderEditLineInput,
} from "@/lib/actions/purchase-order";
import { Field, Select, TextInput } from "@/components/forms/Field";
import { formatMoney, formatMultiplier, toDateInputValue, toNumber } from "@/lib/format";
import { APPROVAL_LEVEL_LABELS, PO_STATUS_LABELS } from "@/lib/labels";

const INITIAL_STATE: PurchaseOrderEditFormState = { status: "idle" };

function emptyLine(): PurchaseOrderEditLineInput {
  return { lineId: "", serviceId: "", phaseRef: "", description: "", consultantCost: "", rechargedToClient: "0", invoicedAmount: "0" };
}

export function PurchaseOrderEditForm({
  purchaseOrder,
  suppliers,
  services,
  approvers,
  thresholds,
}: {
  purchaseOrder: {
    id: string;
    number: string;
    supplierId: string;
    description: string | null;
    status: string;
    issueDate: Date | string | null;
    expectedDeliveryDate: Date | string | null;
    approverId: string | null;
    notes: string | null;
    lines: {
      id: string;
      serviceId: string;
      phaseRef: string | null;
      description: string | null;
      consultantCost: string;
      rechargedToClient: string;
      invoicedAmount: string;
    }[];
  };
  suppliers: { id: string; code: string; name: string }[];
  services: { id: string; code: string; commessaCode: string }[];
  approvers: { id: string; name: string }[];
  thresholds: { pm: string; director: string };
}) {
  const [state, formAction, pending] = useActionState(updatePurchaseOrder, INITIAL_STATE);
  const router = useRouter();

  const [lines, setLines] = useState<PurchaseOrderEditLineInput[]>(
    purchaseOrder.lines.length > 0
      ? purchaseOrder.lines.map((l) => ({
          lineId: l.id,
          serviceId: l.serviceId,
          phaseRef: l.phaseRef ?? "",
          description: l.description ?? "",
          consultantCost: l.consultantCost,
          rechargedToClient: l.rechargedToClient,
          invoicedAmount: l.invoicedAmount,
        }))
      : [emptyLine()]
  );

  useEffect(() => {
    if (state.status === "success") router.push(`/admin/fornitori/${state.updatedSupplierId}/scheda`);
  }, [state.status, state.updatedSupplierId, router]);

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

  function updateLine(i: number, patch: Partial<PurchaseOrderEditLineInput>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(i: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  const v = state.values;
  const err = state.errors ?? {};

  return (
    <form action={formAction} className="flex max-w-3xl flex-col gap-6">
      <input type="hidden" name="id" value={purchaseOrder.id} />
      {err._form && (
        <p className="rounded-md border border-status-critical/30 bg-status-critical/10 px-3 py-2 text-sm text-status-critical">
          {err._form}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="Numero ordine" htmlFor="number" error={err.number}>
          <TextInput id="number" name="number" defaultValue={v?.number ?? purchaseOrder.number} />
        </Field>
        <Field label="Fornitore" htmlFor="supplierId" error={err.supplierId}>
          <Select id="supplierId" name="supplierId" defaultValue={v?.supplierId ?? purchaseOrder.supplierId}>
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
        <TextInput id="description" name="description" defaultValue={v?.description ?? purchaseOrder.description ?? ""} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Stato" htmlFor="status" error={err.status}>
          <Select id="status" name="status" defaultValue={v?.status ?? purchaseOrder.status}>
            {Object.entries(PO_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Approvatore" htmlFor="approverId" error={err.approverId} hint="Facoltativo">
          <Select id="approverId" name="approverId" defaultValue={v?.approverId ?? purchaseOrder.approverId ?? ""}>
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
          <TextInput
            type="date"
            id="issueDate"
            name="issueDate"
            defaultValue={v?.issueDate ?? toDateInputValue(purchaseOrder.issueDate)}
          />
        </Field>
        <Field label="Consegna prevista" htmlFor="expectedDeliveryDate" error={err.expectedDeliveryDate} hint="Facoltativa">
          <TextInput
            type="date"
            id="expectedDeliveryDate"
            name="expectedDeliveryDate"
            defaultValue={v?.expectedDeliveryDate ?? toDateInputValue(purchaseOrder.expectedDeliveryDate)}
          />
        </Field>
      </div>

      <Field label="Note" htmlFor="notes" error={err.notes} hint="Facoltative">
        <TextInput id="notes" name="notes" defaultValue={v?.notes ?? purchaseOrder.notes ?? ""} />
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
          const e = err.lines?.[i] ?? {};

          return (
            <div key={i} className="flex flex-col gap-3 rounded-md border border-gridline p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-muted">
                  Riga {i + 1}
                  {!line.lineId && <span className="ml-1.5 text-accent">(nuova)</span>}
                </span>
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
                <Field label="Fatturato (€)" htmlFor={`line-${i}-invoiced`} error={e.invoicedAmount} hint="Dal fornitore verso di noi">
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
            + Aggiungi riga (es. un altro servizio, LEED/CRREM/...)
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
          {pending ? "Salvataggio…" : "Salva modifiche"}
        </button>
      </div>
    </form>
  );
}
