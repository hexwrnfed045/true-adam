export class ApiError extends Error {
  constructor(message: string, public status = 0, public fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const queryIndex = path.indexOf('?');
  const route = queryIndex < 0 ? path : path.slice(0, queryIndex);
  const query = queryIndex < 0 ? '' : path.slice(queryIndex);
  const url = `${route.endsWith('/') ? route : `${route}/`}${query}`;
  let response: Response;
  try {
    response = await fetch(url, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
      headers: { Accept: 'application/json', ...options.headers },
      signal: options.signal ?? AbortSignal.timeout(45000),
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError('Не удалось связаться с сервером. Проверьте соединение и повторите попытку.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(data?.error || (response.status === 413 ? 'Слишком большой объём фотографий.' : 'Запрос не выполнен. Попробуйте ещё раз.'), response.status, data?.fieldErrors || {});
  }
  if (data === null) throw new ApiError('Сервер вернул неожиданный ответ. Попробуйте ещё раз.', response.status);
  return data as T;
}

export function jsonRequest<T>(path: string, method: string, data?: unknown): Promise<T> {
  return api<T>(path, { method, headers: { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
}

export function safeReturnTo(value: string | null, fallback = '/account'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  try {
    const url = new URL(value, 'http://runway.local');
    if (url.origin !== 'http://runway.local' || ['/login', '/register'].includes(url.pathname.replace(/\/$/, ''))) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return fallback; }
}
