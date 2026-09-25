import { focusRing } from "@/components/ui/styles";

export function ErrorState({
  title = "Something went wrong",
  message = "This page could not be loaded. Try again.",
  titleLevel = "h2",
  onRetry,
}: {
  title?: string;
  message?: string;
  titleLevel?: "h1" | "h2";
  onRetry?: () => void;
}) {
  const Title = titleLevel;

  return (
    <div role="alert" className="rounded-2xl border border-amber-800/30 px-6 py-8">
      <Title className={`text-lg font-semibold ${titleLevel === "h1" ? focusRing : ""}`} tabIndex={titleLevel === "h1" ? -1 : undefined}>
        {title}
      </Title>
      <p className="mt-2 max-w-xl text-ink/80 dark:text-paper/80">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className={`mt-4 inline-flex h-10 items-center rounded-full bg-ink px-4 text-sm font-medium text-paper dark:bg-paper dark:text-ink ${focusRing}`}
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
