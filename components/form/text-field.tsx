import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

const controlClassName =
  "h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-base text-ink focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest";

type FieldExtras = {
  label: string;
  error?: string;
  // Help shown under the label, read out with the field.
  hint?: string;
};

// Error and hint text tied to the control, so a screen reader reads them with it.
function describe(fieldId: string | undefined, error?: string, hint?: string) {
  const ids = [hint ? `${fieldId}-hint` : null, error ? `${fieldId}-error` : null].filter(Boolean);
  return {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": ids.length > 0 ? ids.join(" ") : undefined,
  } as const;
}

function Hint({ fieldId, hint }: { fieldId?: string; hint?: string }) {
  return hint ? (
    <p id={`${fieldId}-hint`} className="text-sm text-slate">
      {hint}
    </p>
  ) : null;
}

function FieldError({ fieldId, error }: { fieldId?: string; error?: string }) {
  return error ? (
    <p id={`${fieldId}-error`} className="text-sm text-destructive">
      {error}
    </p>
  ) : null;
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & FieldExtras;

export function TextField({ label, error, hint, id, name, ...props }: TextFieldProps) {
  const fieldId = id ?? name;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={fieldId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <Hint fieldId={fieldId} hint={hint} />
      <input id={fieldId} name={name} className={controlClassName} {...describe(fieldId, error, hint)} {...props} />
      <FieldError fieldId={fieldId} error={error} />
    </div>
  );
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & FieldExtras;

export function SelectField({
  label,
  error,
  hint,
  id,
  name,
  children,
  ...props
}: SelectFieldProps) {
  const fieldId = id ?? name;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={fieldId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <Hint fieldId={fieldId} hint={hint} />
      <select id={fieldId} name={name} className={controlClassName} {...describe(fieldId, error, hint)} {...props}>
        {children}
      </select>
      <FieldError fieldId={fieldId} error={error} />
    </div>
  );
}

type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & FieldExtras;

export function TextAreaField({
  label,
  error,
  hint,
  id,
  name,
  ...props
}: TextAreaFieldProps) {
  const fieldId = id ?? name;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={fieldId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <Hint fieldId={fieldId} hint={hint} />
      <textarea
        id={fieldId}
        name={name}
        className={`${controlClassName} h-auto min-h-24 py-2`}
        {...describe(fieldId, error, hint)}
        {...props}
      />
      <FieldError fieldId={fieldId} error={error} />
    </div>
  );
}
