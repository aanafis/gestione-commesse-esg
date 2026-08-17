"use client";

import { useActionState } from "react";
import { requestMagicLink, type MagicLinkFormState } from "@/lib/actions/auth";
import { Field, TextInput } from "@/components/forms/Field";

const INITIAL_STATE: MagicLinkFormState = { status: "idle" };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(requestMagicLink, INITIAL_STATE);

  if (state.status === "sent") {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 text-sm text-ink-secondary">
        <p>Se l&apos;indirizzo corrisponde a un account attivo, riceverai un link di accesso via email.</p>
        {state.devLoginUrl && (
          <div className="rounded-md border border-accent/40 bg-page p-3 text-xs">
            <p className="mb-1 font-medium text-ink-primary">
              Modalità sviluppo — nessuna email è stata inviata davvero:
            </p>
            <a href={state.devLoginUrl} className="break-all text-accent hover:underline">
              {state.devLoginUrl}
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.status === "error" && <p className="text-sm text-status-critical">{state.error}</p>}
      <Field label="Email di lavoro" htmlFor="email">
        {/* eslint-disable-next-line jsx-a11y/no-autofocus -- unica azione della pagina di login */}
        <TextInput type="email" id="email" name="email" required autoFocus />
      </Field>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Invio…" : "Invia link di accesso"}
      </button>
    </form>
  );
}
