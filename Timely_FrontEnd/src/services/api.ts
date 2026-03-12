const API_BASE = "/api";

function getToken(): string | null {
  const match = document.cookie.match(/(?:^|; )timely_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function setToken(token: string): void {
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `timely_token=${encodeURIComponent(token)}; expires=${expires}; path=/; SameSite=Strict`;
}

export function removeToken(): void {
  document.cookie = "timely_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}

export async function api<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    removeToken();
    window.location.href = "/";
    throw new Error("Session expired. Please log in again.");
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const apiGet = <T = any>(endpoint: string) => api<T>(endpoint);

export const apiPost = <T = any>(endpoint: string, body: any) =>
  api<T>(endpoint, {
    method: "POST",
    body: JSON.stringify(body),
  });

  // Global fetch interceptor
// Patches native fetch so ALL existing fetch() calls automatically get the JWT token
const originalFetch = window.fetch;
window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const match = document.cookie.match(/(?:^|; )timely_token=([^;]*)/);
  const token = match ? decodeURIComponent(match[1]) : null;

  if (token) {
    const headers = new Headers(init?.headers);
    if (!headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    init = { ...init, headers };
  }

  return originalFetch(input, init);
};