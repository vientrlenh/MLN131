import { useEffect, useRef } from 'react'

export type WSEventType = 'new_post' | 'new_comment' | 'new_vote'

export interface WSEvent {
  type: WSEventType
  payload: Record<string, unknown>
}

export function useWebSocket(onEvent: (event: WSEvent) => void) {
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`)

    ws.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as WSEvent
        onEventRef.current(event)
      } catch {
        // ignore malformed messages
      }
    }

    ws.onclose = () => {
      // reconnect after 2s
      setTimeout(() => {
        const ws2 = new WebSocket(`${protocol}//${window.location.host}/ws`)
        ws2.onmessage = ws.onmessage
        ws2.onclose = ws.onclose
      }, 2000)
    }

    return () => ws.close()
  }, [])
}
