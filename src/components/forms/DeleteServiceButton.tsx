"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { deleteService, type DeleteServiceFormState } from "@/lib/actions/service";

const INITIAL_STATE: DeleteServiceFormState = { status: "idle" };

export function DeleteServiceButton({ serviceId, serviceCode }: { serviceId: string; serviceCode: string }) {
  const [state, formAction, pending] = useActionState(deleteService, INITIAL_STATE);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success") router.push("/servizi");
  }, [state.status, router]);

  return (
    <div className="flex flex-col items-start gap-1 rounded-lg border border-status-critical/30 bg-status-critical/5 p-4">
      <p className="text-xs text-ink-secondary">
        Cancella permanentemente il servizio e tutto ciò che vi è collegato (fasi, assegnazioni, ore, SAL, righe
        ODA non ancora fatturate). Operazione irreversibile.
      </p>
      <form
        action={formAction}
        onSubmit={(e) => {
          if (
            !window.confirm(
              `Eliminare definitivamente il servizio ${serviceCode}? Cancella anche fasi, assegnazioni, ore e SAL/ODA collegati non ancora fatturati. Questa operazione non si può annullare.`
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="id" value={serviceId} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-status-critical px-3 py-1.5 text-sm font-medium text-status-critical hover:bg-status-critical/10 disabled:opacity-50"
        >
          {pending ? "Eliminazione…" : "Elimina servizio"}
        </button>
      </form>
      {state.status === "error" && <span className="text-xs text-status-critical">{state.error}</span>}
    </div>
  );
}
