export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

type Options = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  form?: FormData
  signal?: AbortSignal
}

let onUnauthorized: (() => void) | null = null

/** Called on any 401 (except the session check itself) so the app can drop the stale session. */
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn
}

export const API_BASE = '/api'

export async function api<T>(path: string, { method = 'GET', body, form, signal }: Options = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(API_BASE + path, {
      method,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
      signal,
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    throw new ApiError(0, 'Cannot reach the server. Check that the backend is running.')
  }

  if (res.status === 204) return undefined as T

  const text = await res.text()
  let data: unknown
  try {
    data = text ? JSON.parse(text) : undefined
  } catch {
    data = undefined
  }

  if (!res.ok) {
    if (res.status === 401 && path !== '/auth/me' && onUnauthorized) onUnauthorized()
    const detail = (data as { detail?: unknown } | undefined)?.detail
    // The backend always answers errors with JSON; an empty 5xx comes from the dev proxy when the
    // backend isn't running (or crashed during the request).
    const message =
      typeof detail === 'string'
        ? detail
        : res.status >= 500 && !text
          ? 'Cannot reach the backend server. Check that it is running (see the Backend window or backend/logs/app.log).'
          : res.status >= 500
            ? 'Something went wrong on the server.'
            : 'Request failed.'
    throw new ApiError(res.status, message)
  }
  return data as T
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError || e instanceof Error) return e.message
  return 'Something went wrong.'
}

export function query(params: Record<string, string | number | boolean | null | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}
