export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export function url(path, params) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== '') query.set(key, value)
  }
  const qs = query.toString()
  return `/api${path}${qs ? `?${qs}` : ''}`
}

function messageFrom(status, data) {
  const detail = data?.detail
  if (Array.isArray(detail)) return detail.map((d) => d.msg?.replace(/^Value error, /, '')).join('. ')
  if (typeof detail === 'string') return detail
  return status === 0 ? 'Cannot reach the server' : `Request failed (${status})`
}

async function request(method, path, { body, params, raw } = {}) {
  const isForm = body instanceof FormData
  let response
  try {
    response = await fetch(url(path, params), {
      method,
      credentials: 'same-origin',
      headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    })
  } catch {
    throw new ApiError(0, messageFrom(0))
  }
  if (response.status === 401 && !path.startsWith('/auth')) {
    window.dispatchEvent(new Event('rms:unauthorized'))
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new ApiError(response.status, messageFrom(response.status, data))
  }
  if (raw) return response
  return response.status === 204 ? null : response.json()
}

export const api = {
  get: (path, params) => request('GET', path, { params }),
  post: (path, body) => request('POST', path, { body }),
  put: (path, body) => request('PUT', path, { body }),
  patch: (path, body) => request('PATCH', path, { body }),
  del: (path) => request('DELETE', path),
  raw: (path, params) => request('GET', path, { params, raw: true }),
}
