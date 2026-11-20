import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import Brand from '../components/Brand'

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
  return <main className="grid min-h-svh bg-white font-sans lg:grid-cols-2">
    <section className="relative flex flex-col justify-between overflow-hidden bg-green-900 px-7 py-8 text-white sm:px-12 lg:p-16">
      <Brand light />
      <div className="relative z-10 max-w-lg py-14 lg:py-24">
        <p className="mb-5 text-sm font-semibold uppercase tracking-[0.2em] text-green-200">Your pharmacy workspace</p>
        <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">A clear start.<br />Every working day.</h1>
        <p className="mt-6 max-w-sm text-lg leading-relaxed text-green-100">Inventory and Sales Management System</p>
      </div>
      <p className="relative z-10 text-sm text-green-200">TGP Lawang Bato · Staff access</p>
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-44 -right-44 size-[32rem] rounded-full border-[64px] border-green-800/60" />
    </section>
    <section className="flex items-center justify-center px-7 py-14 sm:px-12 lg:p-16">
      <div className="w-full max-w-sm">
        <p className="mb-2 text-sm font-semibold text-green-700">WELCOME BACK</p>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Sign in to your account</h2>
        <p className="mt-3 text-base leading-relaxed text-slate-600">Use your assigned staff credentials to continue.</p>
        <form onSubmit={submit} className="mt-9 space-y-6">
          {(error || unavailable) && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error || 'Unable to verify your session. Please try signing in again.'}</p>}
          <div><label htmlFor="username" className="mb-2 block text-sm font-semibold text-slate-800">Username</label>
            <input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck="false" required maxLength={64} className="w-full rounded-lg border border-slate-300 px-4 py-3 text-base outline-none focus:border-green-700 focus:ring-2 focus:ring-green-700/20" /></div>
          <div><label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-800">Password</label>
            <div className="relative"><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required maxLength={128} className="w-full rounded-lg border border-slate-300 py-3 pl-4 pr-20 text-base outline-none focus:border-green-700 focus:ring-2 focus:ring-green-700/20" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} aria-pressed={showPassword} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-0 px-4 text-sm font-semibold text-green-800 focus-visible:outline-2 focus-visible:outline-green-700">{showPassword ? 'Hide' : 'Show'}</button></div></div>
          <button disabled={pending} className="w-full rounded-lg bg-green-700 px-4 py-3.5 text-base font-semibold text-white transition hover:bg-green-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-green-700 disabled:cursor-wait disabled:opacity-60">{pending ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <p className="mt-8 border-t border-slate-100 pt-6 text-sm leading-relaxed text-slate-500">Need an account or help signing in? Contact your administrator.</p>
      </div>
    </section>
  </main>
}
