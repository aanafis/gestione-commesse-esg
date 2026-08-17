import { LoginForm } from "@/components/forms/LoginForm";

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-sm flex-col justify-center gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-primary">Accedi</h1>
        <p className="text-sm text-ink-secondary">
          Inserisci la tua email di lavoro — ti mandiamo un link per accedere, niente password.
        </p>
      </div>
      <LoginForm />
    </div>
  );
}
