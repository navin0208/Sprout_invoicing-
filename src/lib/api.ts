// Small fetch wrapper for calling our own API routes from client components.
export async function apiFetch<T = any>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) }
  });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : null;
  if (!res.ok) {
    const message =
      (body?.error && typeof body.error === 'string' && body.error) ||
      (body?.error?.formErrors?.[0] as string | undefined) ||
      'Something went wrong';
    throw new Error(message);
  }
  return body as T;
}
