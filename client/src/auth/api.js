export async function requestJson(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin', ...options,
    headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), 'X-TGP-Request': '1', ...options.headers },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 401 && (!path.startsWith('/auth/') || path.startsWith('/auth/users'))) window.dispatchEvent(new Event('tgp:unauthorized'))
    const error = new Error(response.status >= 500
      ? 'The service is temporarily unavailable. Please try again.'
      : body.message || 'The request could not be completed.')
    error.status = response.status
    if (body.checkout_state === 'closed') error.checkoutState = 'closed'
    throw error
  }
  return body
}

export const api = (path, options) => requestJson(`/auth${path}`, options)
