import { ArrowLeft, Pencil, Play, Square, Trash2, VideoOff, WifiOff } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { cameraApi } from '../api/endpoints'
import type { LiveSession, LiveStatus } from '../api/types'
import { ModelStatus } from '../components/ModelStatus'
import { Badge, BehaviourBadge } from '../components/ui/Badge'
import { Button, ButtonLink } from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { EmptyState, ErrorState, Loading, Notice } from '../components/ui/States'
import { useWorkspace } from '../context/workspace'
import { useAsync } from '../hooks/useAsync'
import { useLiveStream, type LiveConnection } from '../hooks/useLiveStream'
import { BEHAVIOUR_COLOR, BEHAVIOUR_LABEL, BEHAVIOURS } from '../lib/behaviour'
import { CAMERA_STATUS, KIND_LABEL, sourceText } from '../lib/camera'
import { CameraForm, ConfirmDelete } from './Cameras'
import { formatDuration, formatNumber, formatPercent, secondsSince } from '../lib/format'

/** Live view of one camera: smooth video with every cow boxed, numbered and labelled. */
export default function CameraLive() {
  const { cameraId } = useParams()
  const id = Number(cameraId)
  const { path, isAdmin } = useWorkspace()
  const navigate = useNavigate()
  const autoStarted = useRef<number | null>(null)
  const info = useAsync(async () => {
    const data = await cameraApi.live(id)
    // Cameras are off by default: opening one starts it, once (so a later "Stop" isn't undone by a reload).
    if (autoStarted.current === id) return data
    autoStarted.current = id
    if (data.live.active) return data
    try {
      await cameraApi.start(id)
    } catch {
      return data // the page still offers "Start monitoring", which shows the error
    }
    return cameraApi.live(id)
  }, [id])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stream = useLiveStream(id, canvasRef)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const live = stream.status ?? info.data?.live ?? null
  const camera = info.data?.camera

  async function toggle(start: boolean) {
    setBusy(true)
    setActionError(null)
    try {
      await (start ? cameraApi.start(id) : cameraApi.stop(id))
      info.reload()
    } catch (e) {
      setActionError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (stream.connection === 'not-found' || (!info.data && info.error && /not found/i.test(info.error))) {
    return (
      <Card>
        <EmptyState
          icon={VideoOff}
          title="Camera not found"
          description="It may have been deleted, or you no longer have access to it."
          action={<ButtonLink to={path('cameras')} size="sm">Back to cameras</ButtonLink>}
        />
      </Card>
    )
  }
  if (info.loading) return <Loading />
  if (!camera || !live) return <Card><ErrorState message={info.error ?? ''} onRetry={info.reload} /></Card>

  const status = CAMERA_STATUS[live.status]

  return (
    <div className="flex flex-col gap-6">
      <ModelStatus />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link to={path('cameras')} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            <ArrowLeft className="size-3.5" aria-hidden /> All cameras
          </Link>
          <h2 className="mt-2 flex flex-wrap items-center gap-3 text-[22px] tracking-[-0.01em]">
            <span className="truncate">{camera.name}</span>
            <Badge tone={status.tone}>{status.label}</Badge>
          </h2>
          <p className="mt-1 truncate text-sm text-muted">
            {KIND_LABEL[camera.kind]}: {sourceText(camera)}
            {camera.location && `, ${camera.location}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <>
              <Button variant="secondary" icon={<Pencil className="size-3.5" aria-hidden />} onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button variant="danger" icon={<Trash2 className="size-3.5" aria-hidden />} onClick={() => setDeleting(true)}>
                Delete
              </Button>
            </>
          )}
          <Button
            variant={live.active ? 'secondary' : 'primary'}
            icon={live.active ? <Square className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
            loading={busy}
            onClick={() => toggle(!live.active)}
          >
            {live.active ? 'Stop monitoring' : 'Start monitoring'}
          </Button>
        </div>
      </div>
      {actionError && <Notice>{actionError}</Notice>}
      <ConnectionNotice connection={stream.connection} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="min-w-0 self-start">
          <CardHeader title="Live view" description="Every cow is boxed with its number and behaviour. A cow keeps its number while it stays in view." />
          <CardBody className="flex flex-col gap-3">
            <div className={`relative overflow-hidden rounded-md border border-line bg-ink ${live.active ? '' : 'hidden'}`}>
              <canvas
                ref={canvasRef}
                role="img"
                aria-label={`Live video from ${camera.name} with detected cows`}
                className={`block h-auto w-full ${stream.hasFrame ? '' : 'invisible aspect-video'}`}
              />
              <VideoOverlay live={live} hasFrame={stream.hasFrame} />
            </div>
            {live.active ? (
              <StreamFooter live={live} />
            ) : (
              <EmptyState
                icon={VideoOff}
                title="Monitoring is off"
                description="Start monitoring to watch the camera with every cow labelled."
                action={
                  <Button icon={<Play className="size-3.5" aria-hidden />} loading={busy} onClick={() => toggle(true)}>
                    Start monitoring
                  </Button>
                }
              />
            )}
          </CardBody>
        </Card>

        <div className="flex min-w-0 flex-col gap-6">
          <InView live={live} />
          {live.session && <SessionCard session={live.session} activityLink={live.session.analysis_id ? `${path('activity')}?analysis=${live.session.analysis_id}` : null} />}
        </div>
      </div>

      {editing && (
        <CameraForm
          camera={camera}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            info.reload()
          }}
        />
      )}
      <ConfirmDelete camera={deleting ? camera : null} onClose={() => setDeleting(false)} onDeleted={() => navigate(path('cameras'))} />
    </div>
  )
}

function ConnectionNotice({ connection }: { connection: LiveConnection }) {
  if (connection === 'logged-out')
    return (
      <Notice>
        Your session has expired. <Link to="/login" className="font-medium underline">Log in again</Link> to keep watching.
      </Notice>
    )
  if (connection === 'reconnecting')
    return (
      <Notice tone="warning">
        <span className="inline-flex items-center gap-2">
          <WifiOff className="size-4" aria-hidden /> Lost the connection to the server. Reconnecting automatically.
        </span>
      </Notice>
    )
  return null
}

/** Messages shown on top of the video area while there is nothing (new) to show. */
function VideoOverlay({ live, hasFrame }: { live: LiveStatus; hasFrame: boolean }) {
  let message: string | null = null
  let tone = 'text-white'
  if (live.status === 'error') {
    message = live.last_error ?? 'The camera can’t be read.'
    tone = 'text-[#ffb4a8]'
  } else if (live.status === 'connecting') {
    message = 'Connecting to the camera'
  } else if (!hasFrame) {
    message = 'Starting the live view'
  }
  if (!message) return null
  return (
    <div className={`absolute inset-0 flex items-center justify-center p-6 text-center ${hasFrame ? 'bg-ink/60' : ''}`} role="status">
      <p className={`max-w-md text-sm font-medium ${tone}`}>{message}</p>
    </div>
  )
}

function StreamFooter({ live }: { live: LiveStatus }) {
  const running = live.status === 'running'
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-sm">
      <p className="text-muted">
        {running ? (
          <>
            Video <span className="font-medium text-ink tabular-nums">{Math.round(live.stream_fps)}</span> fps, boxes updated{' '}
            <span className="font-medium text-ink tabular-nums">{Math.round(live.detect_fps)}</span> times a second
          </>
        ) : (
          'Waiting for video'
        )}
      </p>
      <ul className="flex flex-wrap gap-1.5" aria-label="Box colours">
        {BEHAVIOURS.map((b) => (
          <li key={b}>
            <BehaviourBadge behaviour={b} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function InView({ live }: { live: LiveStatus }) {
  const cows = live.active && live.status === 'running' ? live.in_view : []
  return (
    <Card>
      <CardHeader title="In view now" description="Cows the model sees at this moment" />
      <CardBody>
        <p className="text-[30px] leading-none font-semibold tabular-nums">{cows.length}</p>
        <p className="mt-1 text-sm text-muted">{cows.length === 1 ? 'cow' : 'cows'} in view</p>
      </CardBody>
      {cows.length > 0 && (
        <ul className="divide-y divide-line border-t border-line">
          {cows.map((c, i) => (
            <li key={c.track_id ?? `x${i}`} className="flex items-center gap-3 px-5 py-2.5 text-sm">
              <span className="w-10 font-medium tabular-nums">{c.track_id ? `#${c.track_id}` : '—'}</span>
              <span className="flex-1">
                <BehaviourBadge behaviour={c.behaviour} />
                {c.posture && c.state && <span className="ml-2 text-muted">({c.posture})</span>}
              </span>
              <span className="text-muted tabular-nums">{formatPercent(c.confidence)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function SessionCard({ session, activityLink }: { session: LiveSession; activityLink: string | null }) {
  const total = BEHAVIOURS.reduce((n, b) => n + (session.behaviour_counts[b] ?? 0), 0)
  const parts = BEHAVIOURS.map((b) => ({ b, n: session.behaviour_counts[b] ?? 0 }))
    .filter((p) => p.n > 0)
    .sort((x, y) => y.n - x.n)
  return (
    <Card>
      <CardHeader title="This session" description={`Monitoring for ${formatDuration(secondsSince(session.started_at))}`} />
      <CardBody className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-muted">Cows tracked</dt>
            <dd className="text-xl font-semibold tabular-nums">{formatNumber(session.cows_tracked)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Detections saved</dt>
            <dd className="text-xl font-semibold tabular-nums">{formatNumber(session.detections)}</dd>
          </div>
        </dl>
        {total > 0 && (
          <div>
            <div
              className="flex h-2.5 gap-0.5 overflow-hidden rounded-full"
              role="img"
              aria-label={parts.map((p) => `${BEHAVIOUR_LABEL[p.b]} ${Math.round((p.n / total) * 100)}%`).join(', ')}
            >
              {parts.map((p) => (
                <div key={p.b} style={{ width: `${(p.n / total) * 100}%`, backgroundColor: BEHAVIOUR_COLOR[p.b] }} />
              ))}
            </div>
            <ul className="mt-3 flex flex-col gap-1.5">
              {parts.map((p) => (
                <li key={p.b} className="flex items-center justify-between text-sm">
                  <BehaviourBadge behaviour={p.b} />
                  <span className="text-muted tabular-nums">{Math.round((p.n / total) * 100)}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {activityLink && (
          <Link to={activityLink} className="text-sm font-medium text-primary hover:underline">
            See every detection in the activity log
          </Link>
        )}
      </CardBody>
    </Card>
  )
}
