import type { Camera, CameraKind, CameraStatus } from '../api/types'

export const KIND_LABEL: Record<CameraKind, string> = {
  webcam: 'Webcam',
  stream: 'Network stream',
  video: 'Recorded video',
}

export const CAMERA_STATUS: Record<CameraStatus, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  running: { label: 'Live', tone: 'success' },
  connecting: { label: 'Connecting', tone: 'warning' },
  error: { label: 'Error', tone: 'danger' },
  stopped: { label: 'Stopped', tone: 'neutral' },
}

/** Human-readable source, e.g. "Webcam 0" or "File: barn.mp4". */
export function sourceText(c: Camera): string {
  if (c.kind === 'webcam') return `Webcam ${c.source}`
  if (c.kind === 'video') return c.uploaded ? `File: ${c.source}` : c.source
  return c.source
}
