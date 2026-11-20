import { useState } from 'react'
import { requestJson } from '../auth/api'
import { Field, fieldClass, buttonClass, secondaryClass } from '../inventory/shared'
import Modal from '../components/Modal'

export default function AccountForm({ onSaved, onCancel }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    const name = values.get('full_name').trim()
    const body = { username: values.get('username'), password: values.get('password'), role: values.get('role'), ...(name ? { full_name: name } : {}) }
    form.elements.namedItem('password').value = ''
    setPending(true); setError('')
    try { onSaved((await requestJson('/auth/users', { method: 'POST', body: JSON.stringify(body) })).user) }
    catch (failure) {
      setError(failure.status ? `${failure.message} Enter the password again before retrying.` : 'Account creation could not be confirmed. Search or refresh the account list before trying again. The password was cleared.')
    } finally { setPending(false) }
  }
  return <Modal title="Add user" onClose={onCancel} busy={pending}><section aria-label="Add user">
    <p className="mt-2 text-sm text-slate-600">Create an Employee or Manager account. New accounts use the existing active-account workflow.</p>
    <form className="mt-5" onSubmit={submit}>
      <fieldset disabled={pending}>
        <legend className="sr-only">New account details</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Full name (optional)" id="account-name" name="full_name" maxLength={120} autoComplete="off" />
          <Field label="Username" id="account-username" name="username" required maxLength={64} pattern="[A-Za-z0-9_.-]+" autoComplete="off" autoCapitalize="none" spellCheck="false" />
          <div><label htmlFor="account-role" className="mb-2 block text-sm font-medium text-slate-700">Role</label><select id="account-role" name="role" required className={fieldClass} defaultValue="employee"><option value="employee">Employee</option><option value="manager">Manager</option></select></div>
          <Field label="Initial password" id="account-password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required aria-describedby="password-guidance" />
        </div>
        <p id="password-guidance" className="mt-3 text-xs text-slate-500">Use 12–128 characters. Passwords are cleared from the form after submission and are never shown in account details.</p>
        <div className="mt-6 flex flex-wrap justify-between gap-3"><button className={secondaryClass} type="button" onClick={onCancel}>Cancel</button><button className={buttonClass}>{pending ? 'Creating...' : 'Create account'}</button></div>
      </fieldset>
      {error && <p role="alert" className="mt-4 text-sm text-red-800">{error}</p>}
    </form>
  </section></Modal>
}
