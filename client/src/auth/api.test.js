// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { requestJson } from './api'
afterEach(() => vi.unstubAllGlobals())
test('expired protected account requests trigger session refresh without looping on auth/me',async()=>{
  const expired=vi.fn()
  window.addEventListener('tgp:unauthorized',expired)
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:false,status:401,json:async()=>({message:'Please sign in again.'})})))
  try {
    await expect(requestJson('/auth/users')).rejects.toMatchObject({status:401})
    expect(expired).toHaveBeenCalledTimes(1)
    await expect(requestJson('/auth/me')).rejects.toMatchObject({status:401})
    expect(expired).toHaveBeenCalledTimes(1)
  } finally {window.removeEventListener('tgp:unauthorized',expired)}
})
test('multipart requests preserve browser boundaries and existing CSRF/cookie controls', async () => {
  const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) }))
  vi.stubGlobal('fetch', fetch)
  const body = new FormData(); body.append('expected_image', '')
  await requestJson('/products/1/image', { method: 'PUT', body })
  expect(fetch.mock.calls[0][1].headers['Content-Type']).toBeUndefined()
  expect(fetch.mock.calls[0][1].headers['X-TGP-Request']).toBe('1')
  expect(fetch.mock.calls[0][1].credentials).toBe('same-origin')
  await requestJson('/products', { method: 'POST', body: '{}' })
  expect(fetch.mock.calls[1][1].headers['Content-Type']).toBe('application/json')
})
test('checkout correction acknowledgement is carried only for explicit server-closed references',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:false,status:422,json:async()=>({message:'Correct cash',checkout_state:'closed'})})))
  await expect(requestJson('/pos/checkout',{method:'POST',body:'{}'})).rejects.toMatchObject({status:422,checkoutState:'closed'})
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:false,status:409,json:async()=>({message:'Conflict'})})))
  try{await requestJson('/pos/checkout',{method:'POST',body:'{}'})}catch(error){expect(error.checkoutState).toBeUndefined()}
})
