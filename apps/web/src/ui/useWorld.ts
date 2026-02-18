import { useEffect, useMemo, useRef, useState } from 'react'
import type { AgentId, EventEnvelope, LocationId, WorldState } from './types'

type Msg =
  | { type: 'state'; data: WorldState }
  | { type: 'event'; data: EventEnvelope }

const defaultApiBase = (import.meta as any).env?.VITE_API_BASE ?? 'http://localhost:8787'

export function useWorld(apiBase?: string, token?: string) {
  const base = apiBase ?? defaultApiBase
  const [state, setState] = useState<WorldState | null>(null)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const retryRef = useRef(0)

  const wsUrl = useMemo(() => base.replace(/^http/, 'ws'), [base])
  const authToken = token ?? localStorage.getItem('app_token') ?? ''
  const wsUrlWithToken = useMemo(() => (authToken ? `${wsUrl}?token=${encodeURIComponent(authToken)}` : wsUrl), [wsUrl, authToken])

  useEffect(() => {
    let alive = true
    fetch(`${base}/api/state`, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    })
      .then((r) => r.json())
      .then((s) => { if (alive) setState(s) })
      .catch(() => null)
    return () => { alive = false }
  }, [base, authToken])

  useEffect(() => {
    let alive = true
    let ws: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    function connect() {
      if (!alive) return
      ws = new WebSocket(wsUrlWithToken)
      wsRef.current = ws
      ws.onopen = () => { setConnected(true); retryRef.current = 0 }
      ws.onclose = () => {
        setConnected(false)
        wsRef.current = null
        if (alive) {
          const delay = Math.min(1000 * 2 ** retryRef.current, 8000)
          retryRef.current++
          reconnectTimer = setTimeout(connect, delay)
        }
      }
      ws.onerror = () => ws?.close()
      ws.onmessage = (ev) => {
        try {
          const msg: Msg = JSON.parse(ev.data)
          if (msg.type === 'state') setState(msg.data)
          else if (msg.type === 'event') {
            setState((prev) => {
              if (!prev) return prev
              const feed = [...prev.feed, msg.data].slice(-220)
              return { ...prev, feed }
            })
          }
        } catch { /* ignore */ }
      }
    }

    connect()
    return () => {
      alive = false
      if (reconnectTimer) clearTimeout(reconnectTimer)
      ws?.close()
    }
  }, [wsUrlWithToken])

  function apiPost(path: string, body: any) {
    return fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify(body),
    }).catch(() => null)
  }

  const setSpeed = (speed: number) => apiPost('/api/control/speed', { speed })
  const injectEvent = (text: string) => apiPost('/api/control/event', { text })
  const sendMessage = (agentId: AgentId, text: string) => apiPost('/api/control/message', { agentId, text })
  const setGoal = (agentId: AgentId, goal: string) => apiPost('/api/control/goal', { agentId, goal })
  const sendChallenge = (locationId: LocationId, text: string) => apiPost('/api/control/challenge', { locationId, text })

  return { state, connected, setSpeed, injectEvent, sendMessage, setGoal, sendChallenge }
}
