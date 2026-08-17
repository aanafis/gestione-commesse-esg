export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink-primary">
        {label}
      </label>
      {children}
      {hint && !error && <span className="text-xs text-ink-muted">{hint}</span>}
      {error && <span className="text-xs text-status-critical">{error}</span>}
    </div>
  );
}

const inputClass =
  "rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink-primary outline-none focus:border-accent";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}
