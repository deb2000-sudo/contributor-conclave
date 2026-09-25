import { controlClass } from "@/components/ui/styles";

export function SelectField({
  id,
  label,
  name,
  options,
  required = false,
  defaultValue,
  errors,
}: {
  id: string;
  label: string;
  name: string;
  options: { value: string; label: string }[];
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
      <select
        id={id}
        name={name}
        required={required}
        defaultValue={defaultValue}
        aria-invalid={messages.length > 0 ? true : undefined}
        aria-describedby={messages.length > 0 ? errorId : undefined}
        className={controlClass}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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
