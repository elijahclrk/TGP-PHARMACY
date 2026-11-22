import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'

export default function Modal({ title, onClose, busy = false, wide = false, children }) {
  const ref = useRef(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current, opener = document.activeElement
    const background = [...document.body.children].filter(node => node !== dialog).map(node => [node, node.hasAttribute('inert')])
    const overflow = document.body.style.overflow
    for (const [node] of background) node.setAttribute('inert', '')
    document.body.style.overflow = 'hidden'
    if (typeof dialog.showModal === 'function') dialog.showModal()
    else dialog.setAttribute('open', '')
    const first = () => dialog.querySelector('input:not(:disabled), select:not(:disabled), button:not(:disabled)')?.focus()
    first()
    const contain = event => { if (!dialog.contains(event.target)) first() }
    document.addEventListener('focusin', contain)
    return () => {
      document.removeEventListener('focusin', contain)
      if (typeof dialog.close === 'function') dialog.close()
      for (const [node, wasInert] of background) if (!wasInert) node.removeAttribute('inert')
      document.body.style.overflow = overflow
      if (opener?.isConnected) opener.focus()
    }
  }, [])
  function keyboard(event) {
    if (event.key === 'Escape') { event.preventDefault(); if (!busy) onClose(); return }
    if (event.key !== 'Tab') return
    const items = [...ref.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]')]
    if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus() }
    else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus() }
  }
  return createPortal(<dialog ref={ref} className={`ui-modal ${wide ? 'ui-modal-wide' : ''}`} aria-modal="true" aria-labelledby={titleId} aria-busy={busy || undefined} onKeyDown={keyboard} onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <header className="ui-modal-header"><h2 id={titleId}>{title}</h2><button type="button" aria-label={`Close ${title}`} disabled={busy} onClick={onClose}><Icon name="close" /></button></header><div className="ui-modal-body">{children}</div>
  </dialog>, document.body)
}
