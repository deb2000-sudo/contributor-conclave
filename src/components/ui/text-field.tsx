import { controlClass } from "@/components/ui/styles";

export function TextField({
  id,
  label,
  name,
  type = "text",
  autoComplete,
  required = false,
  defaultValue,
  errors,
}: {
  id: string;
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  defaultValue?: string;
  errors?: string[];
}) {
  const errorId = `${id}-error`;
  const messages = errors ?? [];

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        defaultValue={defaultValue}
        aria-invalid={messages.length > 0 ? true : undefined}
        aria-describedby={messages.length > 0 ? errorId : undefined}
        className={controlClass}
      />
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
