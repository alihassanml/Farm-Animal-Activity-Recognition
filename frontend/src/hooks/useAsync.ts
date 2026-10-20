import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from '../api/client'

type State<T> = { key: string; depsKey: string; data?: T; error?: string }

/**
 * Load data for a page. Re-runs when `deps` change or `reload()` is called.
 * - `data` is kept while reloading (no flicker on refresh) but cleared when deps change.
 * - `loading` is true only while there is nothing to show yet.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: readonly unknown[]) {
  const [nonce, setNonce] = useState(0)
  const depsKey = JSON.stringify(deps)
  const key = `${depsKey}#${nonce}`
  const [state, setState] = useState<State<T>>({ key: '', depsKey: '' })
  const fnRef = useRef(fn)

  useEffect(() => {
    fnRef.current = fn
  })

  useEffect(() => {
    let active = true
    fnRef.current().then(
      (data) => {
        if (active) setState({ key, depsKey, data })
      },
      (e) => {
        if (active)
          setState((s) => ({ key, depsKey, data: s.depsKey === depsKey ? s.data : undefined, error: errorMessage(e) }))
      },
    )
    return () => {
      active = false
    }
  }, [key, depsKey])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  const mutate = useCallback((update: (prev: T) => T) => {
    setState((s) => (s.data === undefined ? s : { ...s, data: update(s.data) }))
  }, [])

  const data = state.depsKey === depsKey ? state.data : undefined
  return {
    data,
    error: state.key === key ? state.error : undefined,
    loading: data === undefined && state.key !== key,
    reload,
    mutate,
  }
}

/** Calls `callback` every `ms` milliseconds; pass null to pause. */
export function useInterval(callback: () => void, ms: number | null) {
  const ref = useRef(callback)
  useEffect(() => {
    ref.current = callback
  })
  useEffect(() => {
    if (ms === null) return
    const id = window.setInterval(() => ref.current(), ms)
    return () => window.clearInterval(id)
  }, [ms])
}
