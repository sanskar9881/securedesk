/**
 * Turn an unknown thrown value into a message safe to show a user.
 *
 * Replaces the `catch (err: any)` pattern: `any` disables type checking on the
 * error path, which is exactly where mistakes are least likely to be noticed.
 * The backend now returns `{ detail, error_id }`, so when a correlation id is
 * present we surface it — it's what support will ask for.
 */
export interface ApiErrorBody {
  detail?: string;
  error_id?: string;
  fields?: { field: string; problem: string }[];
}

function bodyOf(err: unknown): ApiErrorBody | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const response = (err as { response?: { data?: unknown } }).response;
  const data = response?.data;
  return typeof data === "object" && data !== null ? (data as ApiErrorBody) : undefined;
}

export function apiErrorMessage(err: unknown, fallback: string): string {
  const body = bodyOf(err);

  if (body?.fields?.length) {
    return body.fields.map((f) => `${f.field}: ${f.problem}`).join(", ");
  }

  const detail = body?.detail;
  if (typeof detail === "string" && detail.trim()) {
    return body?.error_id ? `${detail} (ref ${body.error_id})` : detail;
  }

  // A request that never reached the server (offline, DNS, CORS).
  if (typeof err === "object" && err !== null && !("response" in err)) {
    return "Couldn't reach the server. Check your connection and try again.";
  }

  return fallback;
}

/** HTTP status of a failed request, when there was a response at all. */
export function apiErrorStatus(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  return (err as { response?: { status?: number } }).response?.status;
}
