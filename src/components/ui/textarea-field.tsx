import { controlClass } from "@/components/ui/styles";

export function TextareaField({
  id,
  label,
  name,
  rows = 4,
  required = false,
  maxLength,
  description,
  errors,
}: {
  id: string;
  label: string;
  name: string;
  rows?: number;
  required?: boolean;
  maxLength?: number;
  description?: string;
  errors?: string[];
}) {
  const errorId = `${id}-error`;
  const descriptionId = `${id}-description`;
  const messages = errors ?? [];
  const describedBy = [description ? descriptionId : null, messages.length > 0 ? errorId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={rows}
        required={required}
        maxLength={maxLength}
        aria-invalid={messages.length > 0 ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={controlClass}
      />
      {description ? (
        <p id={descriptionId} className="text-sm text-ink/70 dark:text-paper/70">
          {description}
        </p>
      ) : null}
      {messages.length > 0 ? (
        <ul id={errorId} className="text-sm text-amber-800 dark:text-amber-100">
          {messages.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
