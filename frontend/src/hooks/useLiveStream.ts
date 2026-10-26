import { useEffect, useRef, useState, type RefObject } from 'react'
import { cameraApi } from '../api/endpoints'
import type { LiveStatus } from '../api/types'

export type LiveConnection = 'connecting' | 'open' | 'reconnecting' | 'logged-out' | 'not-found'

/**
 * Follows a camera's live WebSocket.
 * - Video frames are decoded off the main thread (createImageBitmap) and drawn straight onto the
 *   canvas, never through React state, so playback stays smooth however often frames arrive.
 * - If frames arrive faster than they can be drawn, only the newest one is kept (no growing delay).
 * - Status messages (twice a second) update React state.
 * - The connection is re-opened automatically after a network drop or server restart.
 */
export function useLiveStream(cameraId: number, canvas: RefObject<HTMLCanvasElement | null>) {
  const [status, setStatus] = useState<LiveStatus | null>(null)
  const [connection, setConnection] = useState<LiveConnection>('connecting')
  const [hasFrame, setHasFrame] = useState(false)
  const hasFrameRef = useRef(false)

  useEffect(() => {
    let socket: WebSocket | null = null
    let closed = false
    let attempt = 0
    let retryTimer: number | undefined
    let drawing = false
    let pending: Blob | null = null

    async function draw(blob: Blob) {
      pending = blob
      if (drawing) return // the loop below picks up the newest frame when it is done
      drawing = true
      try {
        while (pending && !closed) {
          const next = pending
          pending = null
          let bitmap: ImageBitmap
          try {
            bitmap = await createImageBitmap(next)
          } catch {
            continue // a damaged frame is skipped
          }
          const el = canvas.current
          if (el && !closed) {
            if (el.width !== bitmap.width || el.height !== bitmap.height) {
              el.width = bitmap.width
              el.height = bitmap.height
            }
            el.getContext('2d')?.drawImage(bitmap, 0, 0)
            if (!hasFrameRef.current) {
              hasFrameRef.current = true
              setHasFrame(true)
            }
          }
          bitmap.close()
        }
      } finally {
        drawing = false
      }
    }

    function connect() {
      socket = new WebSocket(cameraApi.liveSocketUrl(cameraId))
      socket.binaryType = 'blob'
      socket.onopen = () => {
        attempt = 0
        setConnection('open')
      }
      socket.onmessage = (event) => {
        if (typeof event.data === 'string') {
          try {
            const message = JSON.parse(event.data) as LiveStatus
            if (message.type === 'status') setStatus(message)
          } catch {
            /* ignore a malformed message */
          }
        } else {
          void draw(event.data as Blob)
        }
      }
      socket.onclose = (event) => {
        if (closed) return
        if (event.code === 4401) return setConnection('logged-out')
        if (event.code === 4404) return setConnection('not-found')
        setConnection('reconnecting')
        retryTimer = window.setTimeout(connect, Math.min(5000, 500 * 2 ** attempt++))
      }
    }

    connect()
    return () => {
      closed = true
      window.clearTimeout(retryTimer)
      socket?.close(1000)
    }
  }, [cameraId, canvas])

  return { status, connection, hasFrame }
}
