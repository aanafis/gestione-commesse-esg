"use client";

import { useActionState } from "react";
import { updateSettings, type SettingsFormState } from "@/lib/actions/settings";
import { Field, TextInput } from "@/components/forms/Field";

const INITIAL_STATE: SettingsFormState = { status: "idle" };

type SettingsRow = {
  defaultMarkup: string;
  pmApprovalThreshold: string;
  directorApprovalThreshold: string;
  hoursAlertThreshold: string;
  maxAcceptableDiscount: string;
  paymentTermsDays: number;
};

export function SettingsForm({ settings }: { settings: SettingsRow }) {
  const [state, formAction, pending] = useActionState(updateSettings, INITIAL_STATE);
  const v = state.values;
  const err = state.errors ?? {};

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-6">
      {state.status === "success" && (
        <p className="rounded-md border border-status-good/30 bg-status-good/10 px-3 py-2 text-sm text-status-good">
          Impostazioni aggiornate.
        </p>
      )}
      {err._form && (
        <p className="rounded-md border border-status-critical/30 bg-status-critical/10 px-3 py-2 text-sm text-status-critical">
          {err._form}
        </p>
      )}

      <Field
        label="Markup di default"
        htmlFor="defaultMarkup"
        error={err.defaultMarkup}
        hint="Moltiplicatore proposto per un nuovo servizio, es. 1.30 = costo +30%"
      >
        <TextInput type="number" id="defaultMarkup" name="defaultMarkup" min="0.01" step="0.01" defaultValue={v?.defaultMarkup ?? settings.defaultMarkup} />
      </Field>

      <Field
        label="Soglia approvazione PM (€)"
        htmlFor="pmApprovalThreshold"
        error={err.pmApprovalThreshold}
        hint="Sotto questa soglia un ODA è approvabile in autonomia"
      >
        <TextInput type="number" id="pmApprovalThreshold" name="pmApprovalThreshold" min="0" step="0.01" defaultValue={v?.pmApprovalThreshold ?? settings.pmApprovalThreshold} />
      </Field>

      <Field
        label="Soglia approvazione Direttore (€)"
        htmlFor="directorApprovalThreshold"
        error={err.directorApprovalThreshold}
        hint="Sopra la soglia PM ma sotto questa: approvazione del project manager"
      >
        <TextInput type="number" id="directorApprovalThreshold" name="directorApprovalThreshold" min="0" step="0.01" defaultValue={v?.directorApprovalThreshold ?? settings.directorApprovalThreshold} />
      </Field>

      <Field
        label="Soglia alert consumo ore"
        htmlFor="hoursAlertThreshold"
        error={err.hoursAlertThreshold}
        hint="Frazione 0-1, es. 0.85 = alert quando le ore consuntivo superano l'85% delle stimate"
      >
        <TextInput type="number" id="hoursAlertThreshold" name="hoursAlertThreshold" min="0" max="1" step="0.01" defaultValue={v?.hoursAlertThreshold ?? settings.hoursAlertThreshold} />
      </Field>

      <Field
        label="Sconto massimo accettabile"
        htmlFor="maxAcceptableDiscount"
        error={err.maxAcceptableDiscount}
        hint="Frazione 0-1, es. 0.10 = alert se lo sconto supera il 10%"
      >
        <TextInput type="number" id="maxAcceptableDiscount" name="maxAcceptableDiscount" min="0" max="1" step="0.01" defaultValue={v?.maxAcceptableDiscount ?? settings.maxAcceptableDiscount} />
      </Field>

      <Field label="Termini di pagamento (giorni)" htmlFor="paymentTermsDays" error={err.paymentTermsDays}>
        <TextInput type="number" id="paymentTermsDays" name="paymentTermsDays" min="0" step="1" defaultValue={v?.paymentTermsDays ?? String(settings.paymentTermsDays)} />
      </Field>

      <div>
        <button type="submit" disabled={pending} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {pending ? "Salvataggio…" : "Salva impostazioni"}
        </button>
      </div>
    </form>
  );
}
