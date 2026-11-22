import { useEffect, useState } from 'react'
import { requestJson } from '../auth/api'
import { secondaryClass } from './shared'

export default function ProductImage({ product, canManage }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState(false)
  const [broken, setBroken] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let current = true
    requestJson(`/products/${product.product_id}/image`).then(result => {
      if (current) { setData(result.data); setError(''); setBroken(false) }
    }).catch(() => { if (current) { setData(null); setError('Images unavailable. Product and stock functions remain available.') } })
    return () => { current = false }
  }, [product.product_id, revision])
  async function change(file) {
    setPending(true); setError(''); setNotice('')
    try {
      let body
      if (file) {
        if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Choose one JPEG/PNG image up to 5 MiB.')
        body = new FormData()
        body.append('expected_image', data.image?.public_id || '')
        body.append('image', file)
      } else body = JSON.stringify({ expected_image: data.image?.public_id || '' })
      const result = await requestJson(`/products/${product.product_id}/image`, { method: file ? 'PUT' : 'DELETE', body })
      setData(result.data); setBroken(false)
      setNotice(result.data.cleanup_pending ? 'Image updated. Provider cleanup needs administrator follow-up.' : 'Image updated.')
    } catch (failure) {
      setData(null)
      setError(failure.status ? 'Image change failed or is uncertain. Reload image status before retrying.' : failure.message || 'Unable to change image. Reload image status before retrying.')
    } finally { setPending(false) }
  }
  return <section aria-label={`Image for ${product.name}`} className="mt-3 max-w-xs space-y-2 text-xs font-normal">
    {data?.image?.url && !broken ? <img src={data.image.url} alt={`${product.name} package`} loading="lazy" className="h-20 w-20 rounded-lg border border-slate-200 object-contain" onError={() => setBroken(true)} /> : <p className="text-slate-500">{!data && !error ? 'Loading image…' : data?.enabled ? 'No image available' : 'Images unavailable'}</p>}
    {error && <p role="alert" className="text-red-800">{error}</p>}
    {notice && <p role="status" className="text-green-800">{notice}</p>}
    {pending && <p role="status">Updating image…</p>}
    <button type="button" className="text-green-800 underline" disabled={pending} onClick={() => { setData(null); setRevision(value => value + 1) }}>Reload image status</button>
    {canManage && data?.enabled && <div className="space-y-2">
      <label className="block text-green-900">{data.image ? 'Replace image' : 'Upload image'} for {product.name}
        <input type="file" accept="image/jpeg,image/png" disabled={pending} className="mt-1 block w-full" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) change(file) }} />
      </label>
      <p className="text-slate-500">Public package images only. JPEG/PNG, up to 5 MiB.</p>
      {data.image && <button type="button" disabled={pending} className={secondaryClass} onClick={() => change(null)}>Remove image for {product.name}</button>}
    </div>}
  </section>
}
