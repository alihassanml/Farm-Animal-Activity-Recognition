import { AlertTriangle, Loader2, Plus, Video, VideoOff } from 'lucide-react'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { cameraApi } from '../api/endpoints'
import type { Camera, CameraKind } from '../api/types'
import { ModelStatus } from '../components/ModelStatus'
import { Button } from '../components/ui/Button'
import { Card, PageHeader } from '../components/ui/Card'
import { Input, Select } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { EmptyState, ErrorState, Loading, Notice } from '../components/ui/States'
import { useWorkspace } from '../context/workspace'
import { useAsync, useInterval } from '../hooks/useAsync'
import { CAMERA_STATUS, KIND_LABEL } from '../lib/camera'

export default function Cameras() {
  const { workspace, isAdmin } = useWorkspace()
  const { data, error, loading, reload } = useAsync(() => cameraApi.list(workspace.id), [workspace.id])
  useInterval(reload, 5000)

  const [adding, setAdding] = useState(false)

  return (
    <div>
      <PageHeader
        title="Cameras"
        description="Click a camera to watch it live with every cow labelled. A recorded video can stand in for a camera: it plays in a loop as if it were live."
        actions={
          isAdmin && (
            <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setAdding(true)}>
              Add camera
            </Button>
          )
        }
      />
      <ModelStatus />

      {loading ? (
        <Loading />
      ) : !data ? (
        <Card>
          <ErrorState message={error ?? ''} onRetry={reload} />
        </Card>
      ) : data.length === 0 ? (
        <Card>
          <EmptyState
            icon={Video}
            title="No cameras yet"
            description={isAdmin ? 'Add a webcam, a CCTV stream, or a recorded video to start monitoring.' : 'Ask a workspace admin to add a camera.'}
            action={isAdmin && <Button onClick={() => setAdding(true)}>Add camera</Button>}
          />
        </Card>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((c) => (
            <li key={c.id}>
              <CameraCard camera={c} />
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <CameraForm
          camera={null}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false)
            reload()
          }}
        />
      )}
    </div>
  )
}

/** One camera as a clickable tile: live snapshot on top, name and status below. Opens the live view. */
function CameraCard({ camera: c }: { camera: Camera }) {
  const { path } = useWorkspace()
  const status = CAMERA_STATUS[c.status]
  return (
    <Link
      to={path(`cameras/${c.id}`)}
      aria-label={`Open live view of ${c.name}`}
      className="block h-full overflow-hidden rounded-md border border-line bg-surface transition-colors duration-150 hover:border-line-strong"
    >
      <CameraPreview camera={c} />
      <div className="flex items-start justify-between gap-4 border-t border-line px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{c.name}</p>
          <p className="truncate text-xs text-muted">{c.location ?? KIND_LABEL[c.kind]}</p>
        </div>
        <span className={`shrink-0 text-xs ${status.tone === 'danger' ? 'text-critical' : 'text-secondary'}`}>{status.label}</span>
      </div>
    </Link>
  )
}

const PREVIEW_REFRESH_MS = 1000

/** Latest annotated frame of a running camera, refreshed about once a second (light enough for a grid). */
function CameraPreview({ camera: c }: { camera: Camera }) {
  const running = c.status === 'running'
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!running) return
    let stopped = false
    let timer: number | undefined
    let shown: string | null = null
    async function tick() {
      if (!document.hidden) {
        try {
          const res = await fetch(cameraApi.frameUrl(c.id), { cache: 'no-store' })
          if (res.ok) {
            const url = URL.createObjectURL(await res.blob())
            if (stopped) return URL.revokeObjectURL(url)
            setSrc(url)
            if (shown) URL.revokeObjectURL(shown)
            shown = url
          } // 404: no frame yet
        } catch {
          // network hiccup: keep showing the last frame
        }
      }
      if (!stopped) timer = window.setTimeout(tick, PREVIEW_REFRESH_MS)
    }
    void tick()
    return () => {
      stopped = true
      window.clearTimeout(timer)
      if (shown) URL.revokeObjectURL(shown)
      setSrc(null)
    }
  }, [running, c.id])

  let placeholder: { icon: typeof Video; text: string; spin?: boolean; danger?: boolean }
  if (c.status === 'error') placeholder = { icon: AlertTriangle, text: c.last_error ?? 'The camera can’t be read.', danger: true }
  else if (c.status === 'connecting') placeholder = { icon: Loader2, text: 'Connecting to the camera', spin: true }
  else if (running) placeholder = { icon: Loader2, text: 'Starting the live view', spin: true }
  else placeholder = { icon: VideoOff, text: 'Monitoring is off' }
  const Icon = placeholder.icon
  const iconTone = placeholder.danger ? 'text-critical' : 'text-faint'

  return (
    <div className={`relative aspect-video overflow-hidden ${running && src ? 'bg-ink' : 'bg-surface-alt'}`}>
      {running && src ? (
        <>
          <img src={src} alt={`Latest frame from ${c.name}`} className="size-full object-cover" />
          <span className="numeric absolute top-2 left-2 rounded-sm bg-black/60 px-2 py-1 text-xs text-white">LIVE</span>
        </>
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-2 p-4 text-center">
          <Icon className={`size-5 ${iconTone} ${placeholder.spin ? 'animate-spin' : ''}`} strokeWidth={1.75} aria-hidden />
          <p className="line-clamp-2 text-xs text-secondary">{placeholder.text}</p>
        </div>
      )}
    </div>
  )
}

const VIDEO_ACCEPT = '.mp4,.avi,.mov,.mkv,.webm'

export function CameraForm({ camera, onClose, onSaved }: { camera: Camera | null; onClose: () => void; onSaved: () => void }) {
  const { workspace } = useWorkspace()
  const [name, setName] = useState(camera?.name ?? '')
  const [kind, setKind] = useState<CameraKind>(camera?.kind ?? 'webcam')
  const [videoFrom, setVideoFrom] = useState<'link' | 'file'>(camera?.uploaded ? 'file' : 'link')
  const [source, setSource] = useState(camera && !camera.uploaded ? camera.source : '')
  const [file, setFile] = useState<File | null>(null)
  const [location, setLocation] = useState(camera?.location ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const usesFile = kind === 'video' && videoFrom === 'file'
  const keepsFile = usesFile && !file && !!camera?.uploaded
  const ready = name.trim() !== '' && (usesFile ? !!file || keepsFile : source.trim() !== '')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!ready) return
    setBusy(true)
    setError(null)
    const loc = location.trim() || null
    try {
      if (camera) {
        await cameraApi.update(camera.id, usesFile ? { name, location: loc } : { name, location: loc, kind, source })
        if (usesFile && file) await cameraApi.replaceVideo(camera.id, file)
      } else if (usesFile && file) {
        await cameraApi.createFromVideo(workspace.id, name, loc, file)
      } else {
        await cameraApi.create(workspace.id, { name, kind, source, location: loc })
      }
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      title={camera ? 'Edit camera' : 'Add camera'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="camera-form" loading={busy} disabled={!ready}>
            {busy && usesFile && file ? 'Uploading' : camera ? 'Save changes' : 'Add camera'}
          </Button>
        </>
      }
    >
      <form id="camera-form" onSubmit={submit} className="flex flex-col gap-4">
        {error && <Notice>{error}</Notice>}
        <Input label="Name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Barn A – feed lane" />
        <Select
          label="Type"
          value={kind}
          onChange={(e) => {
            const next = e.target.value as CameraKind
            setKind(next)
            setSource(camera && camera.kind === next && !camera.uploaded ? camera.source : '')
          }}
        >
          <option value="webcam">Webcam (connected to the server)</option>
          <option value="stream">Network stream (CCTV / IP camera)</option>
          <option value="video">Recorded video (plays in a loop like a live camera)</option>
        </Select>

        {kind === 'webcam' && (
          <Input
            label="Webcam number"
            required
            inputMode="numeric"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="0"
            hint="0 is the first webcam on the server computer, 1 the second, and so on."
          />
        )}

        {kind === 'stream' && (
          <Input
            label="Stream URL"
            required
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="rtsp://user:password@192.168.1.20/stream1"
            hint="RTSP, RTMP or HTTP(S) stream address from the camera or recorder settings."
          />
        )}

        {kind === 'video' && (
          <>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium text-ink">Video from</legend>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {(
                  [
                    ['link', 'A link to a video file'],
                    ['file', 'A file from this computer'],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                    <input
                      type="radio"
                      name="video-from"
                      value={value}
                      checked={videoFrom === value}
                      onChange={() => setVideoFrom(value)}
                      className="size-4 accent-ink"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            {videoFrom === 'link' ? (
              <Input
                label="Video URL"
                required
                type="url"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="https://example.com/barn.mp4"
                hint="A direct link to a video file such as MP4 or WebM. YouTube and other video pages don’t work; upload the file instead."
              />
            ) : (
              <FilePicker file={file} onChange={setFile} current={camera?.uploaded ? camera.source : null} />
            )}
          </>
        )}

        <Input label="Location (optional)" maxLength={200} value={location} onChange={(e) => setLocation(e.target.value)} />
      </form>
    </Modal>
  )
}

function FilePicker({ file, onChange, current }: { file: File | null; onChange: (f: File | null) => void; current: string | null }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        Video file
      </label>
      <input
        id={id}
        type="file"
        accept={VIDEO_ACCEPT}
        aria-describedby={`${id}-hint`}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        className="block w-full text-sm text-muted file:mr-3 file:h-9 file:cursor-pointer file:rounded-sm file:border file:border-line file:bg-surface file:px-3 file:text-sm file:font-medium file:text-ink hover:file:bg-surface-alt"
      />
      <p id={`${id}-hint`} className="text-xs text-muted">
        {file
          ? `${(file.size / 1024 / 1024).toFixed(1)} MB. The file is uploaded to the server when you save.`
          : current
            ? `Current video: ${current}. Choose a file only to replace it.`
            : 'MP4, AVI, MOV, MKV or WebM.'}
      </p>
    </div>
  )
}

export function ConfirmDelete({ camera, onClose, onDeleted }: { camera: Camera | null; onClose: () => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <Modal
      open={camera !== null}
      title="Delete camera"
      onClose={() => {
        setError(null)
        onClose()
      }}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={busy}
            onClick={async () => {
              if (!camera) return
              setBusy(true)
              try {
                await cameraApi.remove(camera.id)
                setError(null)
                onDeleted()
              } catch (e) {
                setError(errorMessage(e))
              } finally {
                setBusy(false)
              }
            }}
          >
            Delete camera
          </Button>
        </>
      }
    >
      {error && (
        <div className="mb-3">
          <Notice>{error}</Notice>
        </div>
      )}
      <p>
        Delete <strong>{camera?.name}</strong>? Monitoring stops and its alerts are removed. Detections already logged are kept.
      </p>
    </Modal>
  )
}
