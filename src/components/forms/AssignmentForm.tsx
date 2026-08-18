"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createAssignment, type AssignmentFormState } from "@/lib/actions/assignment";
import { Field, Select, TextInput } from "@/components/forms/Field";
import { Breakdown, BreakdownRow, Card } from "@/components/Breakdown";
import { formatMoney, formatPercent, toNumber } from "@/lib/format";
import { PROJECT_ROLE_LABELS } from "@/lib/labels";

const INITIAL_STATE: AssignmentFormState = { status: "idle" };

type ServiceOption = {
  serviceId: string;
  code: string;
  commessaCode: string;
  consultantPrice: string | null;
  hoursPrice: string | null;
  contractedPrice: string | null;
  assignedPersonIds: string[];
};

type PersonOption = {
  id: string;
  name: string;
  levelName: string;
  internalCostRate: string;
  soldRate: string;
};

export function AssignmentForm({
  services,
  people,
  initialServiceId,
}: {
  services: ServiceOption[];
  people: PersonOption[];
  initialServiceId?: string;
}) {
  // Chiave di remount: "Assegna un'altra risorsa" (sotto) deve rimettere la
  // maschera a nuovo per lo stesso servizio. Un <Link> verso l'URL su cui ci
  // si trova già (tipico: si arriva qui da /assegnazioni/nuova?serviceId=X e
  // il servizio non cambia) non naviga — nessun effetto al click, bug reale
  // riscontrato dall'utente. Il remount via key bypassa del tutto la
  // questione URL: funziona sia che l'URL cambi sia che resti identico.
  const [instance, setInstance] = useState({ key: 0, serviceId: initialServiceId });
  const router = useRouter();

  return (
    <AssignmentFormInner
      key={instance.key}
      services={services}
      people={people}
      initialServiceId={instance.serviceId}
      onAssignAnother={(serviceId) => {
        // router.refresh() rilegge la pagina server (assignedPersonIds
        // aggiornato con la persona appena assegnata), senza cambiare URL —
        // il remount via key sotto resetta solo lo stato client del form.
        router.refresh();
        setInstance((i) => ({ key: i.key + 1, serviceId }));
      }}
    />
  );
}

function AssignmentFormInner({
  services,
  people,
  initialServiceId,
  onAssignAnother,
}: {
  services: ServiceOption[];
  people: PersonOption[];
  initialServiceId?: string;
  onAssignAnother: (serviceId: string) => void;
}) {
  const [state, formAction, pending] = useActionState(createAssignment, INITIAL_STATE);

  const [serviceId, setServiceId] = useState(state.values?.serviceId || initialServiceId || "");
  const [personId, setPersonId] = useState(state.values?.personId ?? "");
  const [projectRole, setProjectRole] = useState(state.values?.projectRole ?? "");
  const [estimatedHours, setEstimatedHours] = useState(state.values?.estimatedHours ?? "");

  const selectedService = services.find((s) => s.serviceId === serviceId);
  const selectedPerson = people.find((p) => p.id === personId);
  const availablePeople = selectedService
    ? people.filter((p) => !selectedService.assignedPersonIds.includes(p.id) || p.id === personId)
    : people;

  const preview = useMemo(() => {
    const hours = toNumber(estimatedHours) ?? 0;
    const costRate = toNumber(selectedPerson?.internalCostRate) ?? 0;
    const soldRate = toNumber(selectedPerson?.soldRate) ?? 0;
    const hoursPriceNew = hours * soldRate;
    const hoursCostNew = hours * costRate;
    const marginNew = hoursPriceNew - hoursCostNew;

    const consultantPrice = toNumber(selectedService?.consultantPrice) ?? 0;
    const existingHoursPrice = toNumber(selectedService?.hoursPrice) ?? 0;
    const contractedPrice = toNumber(selectedService?.contractedPrice) ?? 0;
    const totalHoursPrice = existingHoursPrice + hoursPriceNew;
    const calculatedPrice = consultantPrice + totalHoursPrice;
    const discount = contractedPrice - calculatedPrice;
    const discountPct = calculatedPrice !== 0 ? discount / calculatedPrice : null;

    return {
      costRate,
      soldRate,
      hoursPriceNew,
      hoursCostNew,
      marginNew,
      consultantPrice,
      existingHoursPrice,
      totalHoursPrice,
      calculatedPrice,
      contractedPrice,
      discount,
      discountPct,
    };
  }, [estimatedHours, selectedPerson, selectedService]);

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6">
        <p className="text-sm text-ink-primary">
          <strong>{state.createdPersonName}</strong> assegnato/a al servizio.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onAssignAnother(state.createdServiceId!)}
            className="text-sm text-accent hover:underline"
          >
            Assegna un&apos;altra risorsa a questo servizio
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
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <form action={formAction} className="flex max-w-md flex-1 flex-col gap-6">
        {err._form && (
          <p className="rounded-md border border-status-critical/30 bg-status-critical/10 px-3 py-2 text-sm text-status-critical">
            {err._form}
          </p>
        )}

        <Field label="Servizio" htmlFor="serviceId" error={err.serviceId}>
          <Select id="serviceId" name="serviceId" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            <option value="">Seleziona…</option>
            {services.map((s) => (
              <option key={s.serviceId} value={s.serviceId}>
                {s.code} ({s.commessaCode})
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Persona" htmlFor="personId" error={err.personId}>
          <Select id="personId" name="personId" value={personId} onChange={(e) => setPersonId(e.target.value)}>
            <option value="">Seleziona…</option>
            {availablePeople.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.levelName})
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Ruolo" htmlFor="projectRole" error={err.projectRole}>
          <Select id="projectRole" name="projectRole" value={projectRole} onChange={(e) => setProjectRole(e.target.value)}>
            <option value="">Seleziona…</option>
            {Object.entries(PROJECT_ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Ore stimate" htmlFor="estimatedHours" error={err.estimatedHours} hint="Base del prezzo (§2) — non del consuntivo">
          <TextInput
            type="number"
            id="estimatedHours"
            name="estimatedHours"
            min="0"
            step="0.5"
            value={estimatedHours}
            onChange={(e) => setEstimatedHours(e.target.value)}
          />
        </Field>

        <div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? "Salvataggio…" : "Assegna risorsa"}
          </button>
        </div>
      </form>

      <div className="flex w-full max-w-sm flex-col gap-4">
        <Card title="Tariffa della persona">
          {selectedPerson ? (
            <Breakdown>
              <BreakdownRow label="Livello" value={selectedPerson.levelName} />
              <BreakdownRow label="Costo interno" value={`${formatMoney(preview.costRate)}/h`} />
              <BreakdownRow label="Tariffa venduta" value={`${formatMoney(preview.soldRate)}/h`} />
            </Breakdown>
          ) : (
            <p className="text-sm text-ink-muted">Seleziona una persona.</p>
          )}
        </Card>

        <Card title="Questa assegnazione">
          <Breakdown>
            <BreakdownRow label="Prezzo ore" value={formatMoney(preview.hoursPriceNew)} />
            <BreakdownRow label="Costo ore" value={formatMoney(preview.hoursCostNew)} />
            <BreakdownRow label="Margine stimato" value={formatMoney(preview.marginNew)} emphasis />
          </Breakdown>
        </Card>

        <Card title="Totale servizio dopo questa assegnazione">
          {selectedService ? (
            <Breakdown>
              <BreakdownRow label="Prezzo consulenti" value={formatMoney(preview.consultantPrice)} />
              <BreakdownRow label="Prezzo ore (esistente + questa)" value={formatMoney(preview.totalHoursPrice)} op="+" />
              <BreakdownRow label="Prezzo calcolato" value={formatMoney(preview.calculatedPrice)} emphasis />
              <BreakdownRow label="Prezzo contrattualizzato" value={formatMoney(preview.contractedPrice)} op="−" />
              <BreakdownRow
                label="Sconto"
                value={`${formatMoney(preview.discount)} (${
                  preview.discountPct === null ? "–" : formatPercent(preview.discountPct)
                })`}
                emphasis
                hint="Negativo = margine ceduto — questo è lo sconto reale una volta assegnate tutte le risorse"
              />
            </Breakdown>
          ) : (
            <p className="text-sm text-ink-muted">Seleziona un servizio.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
