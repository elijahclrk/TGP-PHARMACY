import { useEffect, useState } from 'react'
import { requestJson } from '../auth/api'

export function useInventory(path, revision = 0) {
  const [result, setResult] = useState(null)
  const key = `${path}|${revision}`
  useEffect(() => {
    const controller = new AbortController()
    requestJson(path, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setResult({ key, data })
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ key, error: error.status ? error.message : 'Unable to connect. Please try again.' })
    })
    return () => controller.abort()
  }, [path, key])
  return result?.key === key ? { ...result, loading: false } : { loading: true }
}
