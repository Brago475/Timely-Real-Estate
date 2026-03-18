// Module-level token storage — shared across all imports
let _token: string | null = null;

export function setToken(token: string): void {
  _token = token;
  sessionStorage.setItem("timely_token", token);
  localStorage.setItem("timely_token", token);
}

export function getToken(): string | null {
  if (_token) return _token;
  _token = sessionStorage.getItem("timely_token") || localStorage.getItem("timely_token");
  return _token;
}

export function removeToken(): void {
  _token = null;
  sessionStorage.removeItem("timely_token");
  localStorage.removeItem("timely_token");
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}

// API helper for new code
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

  const response = await fetch(`/api${endpoint}`, { ...options, headers });

  if (response.status === 401) {
    removeToken();
    window.location.href = "/";
    throw new Error("Session expired");
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const apiGet = <T = any>(endpoint: string) => api<T>(endpoint);
export const apiPost = <T = any>(endpoint: string, body: any) =>
  api<T>(endpoint, { method: "POST", body: JSON.stringify(body) });

// Global fetch interceptor — patches ALL existing fetch() calls
const originalFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const token = getToken();

  if (token) {
    const headers = new Headers(init?.headers);
    if (!headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    init = { ...init, headers };
  }

  return originalFetch(input, init);
};