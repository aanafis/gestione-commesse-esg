"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveSupplier, type SupplierFormState } from "@/lib/actions/supplier";
import { Field, Select, TextInput } from "@/components/forms/Field";
import { SUPPLIER_CATEGORY_LABELS } from "@/lib/labels";

const INITIAL_STATE: SupplierFormState = { status: "idle" };

type Supplier = {
  id: string;
  code: string;
  name: string;
  category: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  paymentTerms: string | null;
  vatNumber: string | null;
  notes: string | null;
};

export function SupplierForm({ supplier }: { supplier?: Supplier }) {
  const [state, formAction, pending] = useActionState(saveSupplier, INITIAL_STATE);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success") router.push("/admin/fornitori");
  }, [state.status, router]);

  const v = state.values;
  const err = state.errors ?? {};

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-6">
      <input type="hidden" name="id" value={supplier?.id ?? ""} />
      {err._form && <p className="text-sm text-status-critical">{err._form}</p>}

      <div className="grid grid-cols-2 gap-4">
        <Field label="Codice" htmlFor="code" error={err.code}>
          <TextInput id="code" name="code" defaultValue={v?.code ?? supplier?.code ?? ""} />
        </Field>
        <Field label="Categoria" htmlFor="category" error={err.category}>
          <Select id="category" name="category" defaultValue={v?.category ?? supplier?.category ?? ""}>
            <option value="">Seleziona…</option>
            {Object.entries(SUPPLIER_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Ragione sociale" htmlFor="name" error={err.name}>
        <TextInput id="name" name="name" defaultValue={v?.name ?? supplier?.name ?? ""} />
      </Field>
      <Field label="Referente" htmlFor="contactName" error={err.contactName} hint="Facoltativo">
        <TextInput id="contactName" name="contactName" defaultValue={v?.contactName ?? supplier?.contactName ?? ""} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Email" htmlFor="email" error={err.email} hint="Facoltativa">
          <TextInput type="email" id="email" name="email" defaultValue={v?.email ?? supplier?.email ?? ""} />
        </Field>
        <Field label="Telefono" htmlFor="phone" error={err.phone} hint="Facoltativo">
          <TextInput id="phone" name="phone" defaultValue={v?.phone ?? supplier?.phone ?? ""} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Termini di pagamento" htmlFor="paymentTerms" error={err.paymentTerms} hint="Facoltativi">
          <TextInput id="paymentTerms" name="paymentTerms" defaultValue={v?.paymentTerms ?? supplier?.paymentTerms ?? ""} />
        </Field>
        <Field label="P.IVA" htmlFor="vatNumber" error={err.vatNumber} hint="Facoltativa">
          <TextInput id="vatNumber" name="vatNumber" defaultValue={v?.vatNumber ?? supplier?.vatNumber ?? ""} />
        </Field>
      </div>
      <Field label="Note" htmlFor="notes" error={err.notes} hint="Facoltative">
        <TextInput id="notes" name="notes" defaultValue={v?.notes ?? supplier?.notes ?? ""} />
      </Field>

      <div>
        <button type="submit" disabled={pending} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {pending ? "Salvataggio…" : "Salva"}
        </button>
      </div>
    </form>
  );
}
