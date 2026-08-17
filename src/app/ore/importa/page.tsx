import { TimeEntryImportForm } from "@/components/forms/TimeEntryImportForm";

export default function ImportaOrePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-primary">Importa ore da CSV</h1>
        <p className="text-sm text-ink-secondary">
          Un file al mese dal sistema di timesheet (§4.2). Mappa le colonne del tuo file ai
          campi richiesti — non deve avere nomi o ordine fissi. Ri-importare lo stesso mese
          aggiorna le ore già presenti invece di duplicarle.
        </p>
      </div>
      <TimeEntryImportForm />
    </div>
  );
}
