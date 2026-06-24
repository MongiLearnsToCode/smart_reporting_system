export function getCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]*)/);
  return match ? match[1] : null;
}

export async function ensureCsrfToken(): Promise<string | null> {
  const existing = getCsrfToken();
  if (existing) return existing;
  try {
    const res = await fetch('/api/csrf-token');
    if (!res.ok) return null;
    const data = await res.json();
    return data.token ?? null;
  } catch {
    return null;
  }
}

export function withCsrf(input: RequestInfo | URL, init?: RequestInit): [RequestInfo | URL, RequestInit] {
  const headers = new Headers(init?.headers);
  const token = getCsrfToken();
  if (token) {
    headers.set('x-csrf-token', token);
  }
  return [input, { ...init, headers }];
}
