import { useCallback, useEffect, useRef, useState } from 'react'
import { AuthContext } from './auth-context'
import { api } from './api'

export default function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const requestId = useRef(0)
  const refresh = useCallback(async () => {
    const id = ++requestId.current
    try {
      const result = await api('/me')
      if (id !== requestId.current) return
      setSession(result)
      setUnavailable(false)
    } catch (error) {
      if (id !== requestId.current) return
      setSession(null)
      setUnavailable(error.status !== 401)
    } finally { setLoading(false) }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    const id = ++requestId.current
    api('/me', { signal: controller.signal }).then(result => {
      if (id === requestId.current) { setSession(result); setUnavailable(false) }
    }).catch(error => {
      if (error.name !== 'AbortError' && id === requestId.current) {
        setSession(null)
        setUnavailable(error.status !== 401)
      }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    const timer = setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    window.addEventListener('tgp:unauthorized', refresh)
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('tgp:unauthorized', refresh) }
  }, [refresh])
  useEffect(() => {
    if (!session) return
    const timer = setTimeout(() => setSession(null), Math.max(0, session.expiresAt - Date.now()))
    return () => clearTimeout(timer)
  }, [session])
  const login = async credentials => {
    ++requestId.current
    const result = await api('/login', { method: 'POST', body: JSON.stringify(credentials) })
    ++requestId.current
    setSession(result)
    setUnavailable(false)
  }
  const logout = async () => {
    ++requestId.current
    await api('/logout', { method: 'POST', body: '{}' })
    ++requestId.current
    setSession(null)
  }
  return <AuthContext.Provider value={{ user: session?.user, loading, unavailable, refresh, login, logout }}>{children}</AuthContext.Provider>
}
