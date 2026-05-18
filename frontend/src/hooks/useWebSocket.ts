import { useEffect, useRef } from 'react'
import { WS_URL } from '../config'

export type WSEventType = 'new_post' | 'new_comment' | 'new_vote'

export interface WSEvent {
  type: WSEventType
  payload: Record<string, unknown>
}

function getWsUrl(): string {
  if (WS_URL) return WS_URL
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws`
}

export function useWebSocket(onEvent: (event: WSEvent) => void) {
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    const url = getWsUrl()
    const ws = new WebSocket(url)

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
        const ws2 = new WebSocket(url)
        ws2.onmessage = ws.onmessage
        ws2.onclose = ws.onclose
      }, 2000)
    }

    return () => ws.close()
  }, [])
}
