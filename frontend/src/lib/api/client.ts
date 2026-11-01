export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";

// One request to the API, on the page's own origin (Vite forwards /api).
// Sends and reads JSON; an error answer becomes an ApiError with the API's
// message. A network error stays the fetch error (a TypeError).
export async function request<T>(
  method: Method,
  path: string,
  { body, signal }: { body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const init: RequestInit = { method, signal };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  const response = await fetch(`/api${path}`, init);
  if (!response.ok) throw new ApiError(response.status, await errorMessage(response, method, path));
  // 204 No Content (DELETE)
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

// Nest answers { statusCode, message, error }; message is a list for a
// rejected body
async function errorMessage(response: Response, method: Method, path: string): Promise<string> {
  try {
    const { message } = (await response.json()) as { message?: unknown };
    if (Array.isArray(message)) return message.join("; ");
    if (typeof message === "string") return message;
  } catch {
    // Not JSON: fall back to the status
  }
  return `${method} /api${path} answered ${response.status}`;
}
