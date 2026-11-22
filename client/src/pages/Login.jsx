import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import Brand from '../components/Brand'
import { fieldClass, buttonClass } from '../inventory/shared'
import Icon from '../components/Icon'

export default function Login() {
  const { user, login, unavailable } = useAuth()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  if (user) return <Navigate to={`/${user.role}`} replace />
  async function submit(event) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setPending(true)
    setError('')
    try { await login({ username: data.get('username'), password: data.get('password') }) }
    catch (failure) { setError(failure.status ? failure.message : 'Unable to connect. Please try again.') }
    finally { setPending(false) }
  }
  return <main className="login-layout">
    <section className="login-brand-panel"><Brand light /><div className="login-message"><p>Lawang Bato Branch</p><h2>Better care.<br /> Every day.<br /> For everyone.</h2><span>Your pharmacy workspace for faster service,<br className="hidden sm:block" /> safer stock, and a healthier community.</span></div><p className="login-tagline">Affordable healthcare. Trusted by generations.</p><span className="login-cross" aria-hidden="true">+</span></section>
    <section className="login-form-panel">
      <div className="login-form-content">
        <p className="login-eyebrow">Your pharmacy workspace</p>
        <h1>Welcome back.</h1>
        <p className="mt-3 text-sm text-slate-500">Sign in to start your day at TGP Lawang Bato.</p>
        <form onSubmit={submit} className="mt-8 space-y-5">
          {(error || unavailable) && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error || 'Unable to verify your session. Please try signing in again.'}</p>}
          <div><label htmlFor="username" className="mb-2 block text-sm font-semibold">Username</label>
            <input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck="false" required maxLength={64} className={fieldClass} /></div>
          <div><label htmlFor="password" className="mb-2 block text-sm font-semibold">Password</label>
            <div className="relative"><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required maxLength={128} className={`${fieldClass} pr-20`} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} aria-pressed={showPassword} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-0 px-4 text-sm font-semibold text-red-700 focus-visible:outline-2 focus-visible:outline-red-700">{showPassword ? 'Hide' : 'Show'}</button></div></div>
          <div><p id="role-label" className="mb-2 text-sm font-semibold">Access role</p><p className="login-role" aria-labelledby="role-label">Assigned automatically from your account</p></div>
          <button disabled={pending} className={`${buttonClass} w-full`}>{pending ? 'Signing in...' : 'Sign in'}<Icon name="arrow" /></button>
        </form>
        <p className="mt-6 text-xs leading-relaxed text-slate-500">Need an account or help signing in? Contact your administrator.</p>
      </div>
    </section>
  </main>
}
