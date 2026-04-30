/** Base URL for the Nest API (no trailing slash). Uses same-origin /api when proxied by Vite. */
export function getApiBaseUrl(): string {
  const env = import.meta.env.VITE_API_URL as string | undefined;
  if (env && env.length > 0) return env.replace(/\/$/, '');
  if (typeof window !== 'undefined') return '';
  return '';
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const base = getApiBaseUrl();
  const url = `${base}/api${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    /** Avoid stale 304 cached JSON for GETs after PATCH (venue profile, lists, etc.). */
    cache: init?.cache ?? 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  return handleApiResponse<T>(res);
}

/** Multipart (e.g. tour create/update with optional image). Do not set Content-Type — browser sets boundary. */
export async function apiFetchMultipart<T>(
  path: string,
  init: Omit<RequestInit, 'headers'> & { body: FormData; headers?: HeadersInit },
): Promise<T> {
  const base = getApiBaseUrl();
  const url = `${base}/api${path.startsWith('/') ? path : `/${path}`}`;
  const { body, headers, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    body,
    cache: rest.cache ?? 'no-store',
    headers: {
      ...(headers ?? {}),
    },
  });
  return handleApiResponse<T>(res);
}

async function handleApiResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let userMessage = res.statusText;
    let devDetail: string | undefined;
    try {
      const j = (await res.json()) as {
        message?: string | string[];
        /** Developer-oriented explanation (shown in Network response; also on Error.detail in JS) */
        detail?: string;
      };
      devDetail = typeof j.detail === 'string' ? j.detail : undefined;
      if (typeof j.message === 'string') userMessage = j.message;
      else if (Array.isArray(j.message)) userMessage = j.message.join(', ');
    } catch {
      /* ignore */
    }
    const err = new Error(
      userMessage || `Request failed (${res.status})`,
    ) as Error & { detail?: string };
    if (devDetail) err.detail = devDetail;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  const bodyText = await res.text();
  if (!bodyText.trim()) return undefined as T;
  try {
    return JSON.parse(bodyText) as T;
  } catch {
    throw new Error('Received an invalid response from the server.');
  }
}
