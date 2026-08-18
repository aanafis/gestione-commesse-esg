"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updatePhaseProgress, type PhaseFormState } from "@/lib/actions/phase";
import { Field, Select, TextInput } from "@/components/forms/Field";
import { formatDate } from "@/lib/format";
import { PHASE_STATUS_LABELS, label } from "@/lib/labels";

const INITIAL_STATE: PhaseFormState = { status: "idle" };

type PhaseOption = {
  phaseId: string;
  serviceId: string;
  serviceCode: string;
  commessaCode: string;
  name: string;
  status: string | null;
  daysLate: number | null;
  baselineDate: Date | string | null;
  baselineConfirmed: boolean;
  plannedDate: Date | string | null;
  actualDate: Date | string | null;
  progressPct: string;
  ownerId: string | null;
  contractualMilestone: boolean;
};

function toDateInputValue(v: Date | string | null): string {
  if (!v) return "";
  const d = typeof v === "string" ? new Date(v) : v;
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export function PhaseProgressForm({
  phases,
  people,
  initialServiceId,
}: {
  phases: PhaseOption[];
  people: { id: string; name: string }[];
  initialServiceId?: string;
}) {
  // Chiave di remount: "Aggiorna un'altra fase" (sotto) deve rimettere la
  // maschera a nuovo. Qui l'URL di destinazione CAMBIA davvero (perde
  // ?serviceId=X), ma non basta: React non rimonta questo componente solo
  // perché i props sono cambiati (stessa posizione nell'albero), quindi lo
  // stato di useActionState restava "success" per sempre — il click sembrava
  // non fare nulla, bug reale riscontrato dall'utente. Stessa causa di fondo
  // già vista su AssignmentForm/CommessaForm/ServiceForm, manifestata diversamente.
  const [instance, setInstance] = useState({ key: 0, serviceId: initialServiceId });
  const router = useRouter();

  return (
    <PhaseProgressFormInner
      key={instance.key}
      phases={phases}
      people={people}
      initialServiceId={instance.serviceId}
      onUpdateAnother={(serviceId) => {
        // router.refresh() rilegge le fasi dal server (la percentuale appena
        // salvata), altrimenti il prossimo giro userebbe ancora i vecchi
        // valori se si riseleziona la stessa fase.
        router.refresh();
        setInstance((i) => ({ key: i.key + 1, serviceId }));
      }}
    />
  );
}

function PhaseProgressFormInner({
  phases,
  people,
  initialServiceId,
  onUpdateAnother,
}: {
  phases: PhaseOption[];
  people: { id: string; name: string }[];
  initialServiceId?: string;
  onUpdateAnother: (serviceId: string) => void;
}) {
  const [state, formAction, pending] = useActionState(updatePhaseProgress, INITIAL_STATE);

  const services = Array.from(
    new Map(phases.map((p) => [p.serviceId, `${p.serviceCode} (${p.commessaCode})`])).entries()
  );

  const [serviceId, setServiceId] = useState(initialServiceId ?? services[0]?.[0] ?? "");
  const phasesForService = phases.filter((p) => p.serviceId === serviceId);
  const [phaseId, setPhaseId] = useState(state.values?.phaseId || phasesForService[0]?.phaseId || "");

  const selected = phases.find((p) => p.phaseId === phaseId);

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6">
        <p className="text-sm text-ink-primary">
          Fase <strong>{state.updatedName}</strong> aggiornata.
        </p>
        <div className="flex gap-3">
          <Link href={`/servizi/${state.updatedServiceId}`} className="text-sm text-accent hover:underline">
            Vai alla scheda servizio
          </Link>
          <button
            type="button"
            onClick={() => onUpdateAnother(state.updatedServiceId!)}
            className="text-sm text-ink-secondary hover:underline"
          >
            Aggiorna un&apos;altra fase
          </button>
        </div>
      </div>
    );
  }

  const err = state.errors ?? {};

  return (
    <div className="flex max-w-xl flex-col gap-6">
      {err._form && (
        <p className="rounded-md border border-status-critical/30 bg-status-critical/10 px-3 py-2 text-sm text-status-critical">
          {err._form}
        </p>
      )}

      <Field label="Servizio" htmlFor="serviceSelect">
        <Select
          id="serviceSelect"
          value={serviceId}
          onChange={(e) => {
            setServiceId(e.target.value);
            const first = phases.find((p) => p.serviceId === e.target.value);
            setPhaseId(first?.phaseId ?? "");
          }}
        >
          {services.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Fase" htmlFor="phaseSelect" error={err.phaseId}>
        <Select id="phaseSelect" value={phaseId} onChange={(e) => setPhaseId(e.target.value)}>
          <option value="">Seleziona…</option>
          {phasesForService.map((p) => (
            <option key={p.phaseId} value={p.phaseId}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>

      {selected && (
        <form action={formAction} key={selected.phaseId} className="flex flex-col gap-6">
          <input type="hidden" name="phaseId" value={selected.phaseId} />

          <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-ink-secondary">Stato attuale</span>
              <span className="font-medium text-ink-primary">{label(PHASE_STATUS_LABELS, selected.status)}</span>
            </div>
            {selected.daysLate !== null && (
              <div className="flex items-center justify-between">
                <span className="text-ink-secondary">Giorni di ritardo</span>
                <span className="font-medium text-status-critical">{selected.daysLate}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-ink-secondary">Milestone contrattuale</span>
              <span className="font-medium text-ink-primary">{selected.contractualMilestone ? "Sì" : "No"}</span>
            </div>
          </div>

          {selected.baselineConfirmed ? (
            <Field label="Data baseline" htmlFor="baselineDateReadonly" hint="Confermata — non modificabile (§4.2)">
              <div
                id="baselineDateReadonly"
                className="rounded-md border border-border bg-page px-3 py-2 text-sm text-ink-secondary"
              >
                {formatDate(selected.baselineDate)}
              </div>
            </Field>
          ) : (
            <Field
              label="Data baseline"
              htmlFor="baselineDate"
              error={err.baselineDate}
              hint="Non ancora confermata: impostala una volta sola — dopo il salvataggio non sarà più modificabile"
            >
              <TextInput
                type="date"
                id="baselineDate"
                name="baselineDate"
                defaultValue={toDateInputValue(selected.baselineDate)}
              />
            </Field>
          )}

          <Field label="Responsabile fase" htmlFor="ownerId" error={err.ownerId} hint="Facoltativo">
            <Select id="ownerId" name="ownerId" defaultValue={selected.ownerId ?? ""}>
              <option value="">Nessuno</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Data pianificata" htmlFor="plannedDate" error={err.plannedDate} hint="Si può spostare, a differenza della baseline">
            <TextInput
              type="date"
              id="plannedDate"
              name="plannedDate"
              defaultValue={toDateInputValue(selected.plannedDate)}
            />
          </Field>

          <Field label="Data effettiva" htmlFor="actualDate" error={err.actualDate} hint="Quando la fase è davvero completata">
            <TextInput
              type="date"
              id="actualDate"
              name="actualDate"
              defaultValue={toDateInputValue(selected.actualDate)}
            />
          </Field>

          <Field label="Avanzamento %" htmlFor="progressPct" error={err.progressPct}>
            <TextInput
              type="number"
              id="progressPct"
              name="progressPct"
              min="0"
              max="100"
              step="1"
              defaultValue={String(Math.round(Number(selected.progressPct) * 100))}
            />
          </Field>

          <div>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {pending ? "Salvataggio…" : "Aggiorna fase"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
