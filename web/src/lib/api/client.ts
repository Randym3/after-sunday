import { createClient } from "@/lib/supabase/client";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

let browserClient: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!browserClient) {
    browserClient = createClient();
  }
  return browserClient;
}

// Supabase access tokens expire after about an hour. `getSession()` can
// return an expired token without refreshing it, so refresh explicitly
// before calling the API.
async function getAccessToken(): Promise<string | null> {
  const supabase = getClient();

  let { data } = await supabase.auth.getSession();

  const session = data.session;

  if (
    session?.expires_at &&
    session.expires_at * 1000 <= Date.now()
  ) {
    const refreshed = await supabase.auth.refreshSession();
    data = refreshed.data;
  }

  return data.session?.access_token ?? null;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function errorMessageFromBody(body: unknown): string | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const detail = (body as { detail?: unknown }).detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === "object" && item !== null) {
          const msg = (item as { msg?: unknown }).msg;
          if (typeof msg === "string") {
            return msg;
          }
        }
        return String(item);
      })
      .filter(Boolean);

    if (messages.length > 0) {
      return messages.join("; ");
    }
  }

  return null;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const accessToken = await getAccessToken();

  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    try {
      const body = await response.json();
      message = errorMessageFromBody(body) ?? message;
    } catch {
      // Non-JSON error body; keep the generic message.
    }

    throw new ApiError(message, response.status);
  }

  return (await response.json()) as T;
}
