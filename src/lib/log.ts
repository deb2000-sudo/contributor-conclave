export function logError(
  event: string,
  fields: Record<string, string | number | boolean | null>,
) {
  console.error(JSON.stringify({ level: "error", event, ...fields }));
}
