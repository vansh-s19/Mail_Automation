const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const TOKEN_KEY = "mail_automation_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    clearToken();
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error ?? "Request failed");
  }

  return res.json();
}

export interface Contact {
  id: string;
  name: string | null;
  title: string | null;
  company: string | null;
  phone: string | null;
  email: string;
  locationRaw: string | null;
  resolvedTimezone: string | null;
  isSuppressed: boolean;
  customFields: Record<string, unknown> | null;
  createdAt: string;
}

export interface SyncReport {
  new: number;
  updated: number;
  skipped: number;
  invalid: number;
  needsReview: number;
  total: number;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  getContacts: () => request<Contact[]>("/contacts"),
  syncSheet: () => request<SyncReport>("/contacts/sync-sheet", { method: "POST" }),
};

export { ApiError };
