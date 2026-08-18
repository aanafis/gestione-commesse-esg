"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createTimeEntry, type TimeEntryFormState } from "@/lib/actions/time-entry";
import { Field, Select, TextInput } from "@/components/forms/Field";

const INITIAL_STATE: TimeEntryFormState = { status: "idle" };
const NO_PHASE = "";

type ServiceOption = { id: string; code: string; commessaCode: string };
type PersonOption = { id: string; name: string };
type PhaseOption = { phaseId: string; serviceId: string; name: string };

export function TimeEntryForm({
  services,
  people,
  phases,
  initialServiceId,
}: {
  services: ServiceOption[];
  people: PersonOption[];
  phases: PhaseOption[];
  initialServiceId?: string;
}) {
  // Stessa causa già vista su AssignmentForm/CommessaForm/ServiceForm: il
  // link "Registra un'altra riga" non deve dipendere dal cambio di URL (qui
  // si arriva sempre da /ore/nuova?serviceId=X, cioè lo stesso URL) — un
  // bottone con remount via key + router.refresh() evita il problema.
  const [instance, setInstance] = useState({ key: 0, serviceId: initialServiceId });
  const router = useRouter();

  return (
    <TimeEntryFormInner
      key={instance.key}
      services={services}
      people={people}
      phases={phases}
      initialServiceId={instance.serviceId}
      onLogAnother={(serviceId) => {
        router.refresh();
        setInstance((i) => ({ key: i.key + 1, serviceId }));
      }}
    />
  );
}

function TimeEntryFormInner({
  services,
  people,
  phases,
  initialServiceId,
  onLogAnother,
}: {
  services: ServiceOption[];
  people: PersonOption[];
  phases: PhaseOption[];
  initialServiceId?: string;
  onLogAnother: (serviceId: string) => void;
}) {
  const [state, formAction, pending] = useActionState(createTimeEntry, INITIAL_STATE);

  const [serviceId, setServiceId] = useState(state.values?.serviceId || initialServiceId || "");
  const [phaseId, setPhaseId] = useState(state.values?.phaseId ?? NO_PHASE);
  const phasesForService = phases.filter((p) => p.serviceId === serviceId);

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6">
        <p className="text-sm text-ink-primary">
          <strong>{state.createdPersonName}</strong>: ore {state.wasUpdate ? "aggiornate" : "registrate"} per il
          servizio.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onLogAnother(state.createdServiceId!)}
            className="text-sm text-accent hover:underline"
          >
            Registra un&apos;altra riga per questo servizio
          </button>
          <Link href={`/servizi/${state.createdServiceId}`} className="text-sm text-ink-secondary hover:underline">
            Vai alla scheda servizio
          </Link>
        </div>
      </div>
    );
  }

  const err = state.errors ?? {};

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-6">
      {err._form && (
        <p className="rounded-md border border-status-critical/30 bg-status-critical/10 px-3 py-2 text-sm text-status-critical">
          {err._form}
        </p>
      )}

      <Field label="Servizio" htmlFor="serviceId" error={err.serviceId}>
        <Select
          id="serviceId"
          name="serviceId"
          value={serviceId}
          onChange={(e) => {
            setServiceId(e.target.value);
            setPhaseId(NO_PHASE);
          }}
        >
          <option value="">Seleziona…</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} ({s.commessaCode})
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Persona" htmlFor="personId" error={err.personId}>
        <Select id="personId" name="personId" defaultValue={state.values?.personId ?? ""}>
          <option value="">Seleziona…</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Mese" htmlFor="month" error={err.month}>
        <TextInput type="month" id="month" name="month" defaultValue={state.values?.month ?? ""} />
      </Field>

      <Field label="Fase" htmlFor="phaseId" error={err.phaseId} hint="Facoltativa">
        <Select id="phaseId" name="phaseId" value={phaseId} onChange={(e) => setPhaseId(e.target.value)}>
          <option value={NO_PHASE}>Nessuna</option>
          {phasesForService.map((p) => (
            <option key={p.phaseId} value={p.phaseId}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Ore"
        htmlFor="hours"
        error={err.hours}
        hint="Se esiste già una riga manuale per stessa persona/servizio/mese, viene corretta invece di sommarsi"
      >
        <TextInput
          type="number"
          id="hours"
          name="hours"
          min="0"
          step="0.5"
          defaultValue={state.values?.hours ?? ""}
        />
      </Field>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Salvataggio…" : "Registra ore"}
        </button>
      </div>
    </form>
  );
}
