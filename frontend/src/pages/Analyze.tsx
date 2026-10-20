import { FileImage, FileVideo, Upload } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { analysisApi } from '../api/endpoints'
import type { AnalysisDetail, Behaviour } from '../api/types'
import { StatusBadge } from '../components/AnalysisStatusBadge'
import { ModelStatus } from '../components/ModelStatus'
import { BehaviourBadge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, CardBody, CardHeader, PageToolbar } from '../components/ui/Card'
import { EmptyState, ErrorState, Loading, Notice } from '../components/ui/States'
import { Table, Td, Th } from '../components/ui/Table'
import { Tabs } from '../components/ui/Tabs'
import { useWorkspace } from '../context/workspace'
import { useAsync, useInterval } from '../hooks/useAsync'
import { BEHAVIOURS } from '../lib/behaviour'
import { formatDateTime, formatPercent, formatTime } from '../lib/format'

type Mode = 'image' | 'video'

const ACCEPT: Record<Mode, string> = {
  image: '.jpg,.jpeg,.png,.bmp,.webp',
  video: '.mp4,.avi,.mov,.mkv,.webm',
}

export default function Analyze() {
  const { workspace } = useWorkspace()
  const [mode, setMode] = useState<Mode>('image')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<number | null>(null)

  const recent = useAsync(
    () => Promise.all([analysisApi.list(workspace.id, 'image', 10), analysisApi.list(workspace.id, 'video', 10)]),
    [workspace.id],
  )
  const detail = useAsync(() => (selected ? analysisApi.get(selected) : Promise.resolve(null)), [selected])
  const running = detail.data && (detail.data.status === 'queued' || detail.data.status === 'processing')
  const anyRunning = recent.data?.[1].some((a) => a.status === 'queued' || a.status === 'processing')

  useInterval(detail.reload, running ? 2000 : null)
  useInterval(recent.reload, anyRunning || running ? 4000 : null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const a = mode === 'image' ? await analysisApi.image(workspace.id, file) : await analysisApi.video(workspace.id, file)
      setSelected(a.id)
      setFile(null)
      recent.reload()
    } catch (err) {
      setUploadError(errorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  const history = recent.data ? [...recent.data[0], ...recent.data[1]].sort((a, b) => b.created_at.localeCompare(a.created_at)) : []

  return (
    <div>
      <ModelStatus />
      <PageToolbar description="Upload an image or a video from the barn. Each cow is detected and labelled with its behaviour." />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card className="self-start">
          <div className="px-5 pt-2">
            <Tabs
              label="Upload type"
              value={mode}
              onChange={(m) => {
                setMode(m)
                setFile(null)
                setUploadError(null)
              }}
              tabs={[
                { value: 'image', label: 'Image' },
                { value: 'video', label: 'Video' },
              ]}
            />
          </div>
          <CardBody>
            <form onSubmit={submit} className="flex flex-col gap-4">
              <label
                htmlFor="upload-file"
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong bg-page px-4 py-10 text-center hover:border-primary"
              >
                {mode === 'image' ? <FileImage className="size-6 text-muted" aria-hidden /> : <FileVideo className="size-6 text-muted" aria-hidden />}
                <span className="font-medium">{file ? file.name : `Choose ${mode === 'image' ? 'an image' : 'a video'}`}</span>
                <span className="text-sm text-muted">
                  {file
                    ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
                    : mode === 'image'
                      ? 'JPG, PNG, BMP or WebP'
                      : 'MP4, AVI, MOV, MKV or WebM. Processed in the background at 1 frame per second.'}
                </span>
                <input
                  id="upload-file"
                  type="file"
                  accept={ACCEPT[mode]}
                  className="sr-only"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {uploadError && <Notice>{uploadError}</Notice>}
              <Button type="submit" icon={<Upload className="size-4" aria-hidden />} loading={uploading} disabled={!file}>
                {uploading ? (mode === 'image' ? 'Analyzing…' : 'Uploading…') : `Analyze ${mode}`}
              </Button>
            </form>
          </CardBody>
        </Card>

        <ResultPanel selected={selected} detail={detail.data ?? null} loading={detail.loading} error={detail.error} retry={detail.reload} />
      </div>

      <Card className="mt-6">
        <CardHeader title="Recent analyses" description="Your workspace’s latest image and video uploads." />
        {recent.loading ? (
          <Loading />
        ) : !recent.data ? (
          <ErrorState message={recent.error ?? ''} onRetry={recent.reload} />
        ) : history.length === 0 ? (
          <EmptyState title="Nothing analyzed yet" description="Your uploads will be listed here." />
        ) : (
          <Table label="Recent analyses">
            <thead>
              <tr>
                <Th>File</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th className="text-right">Detections</Th>
                <Th>Uploaded</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {history.map((a) => (
                <tr key={a.id} className={a.id === selected ? 'bg-primary-soft/50' : undefined}>
                  <Td className="max-w-64 truncate font-medium">{a.original_name ?? `Analysis #${a.id}`}</Td>
                  <Td className="capitalize">{a.type}</Td>
                  <Td>
                    <StatusBadge status={a.status} />
                  </Td>
                  <Td className="text-right tabular-nums">{a.detection_count}</Td>
                  <Td className="whitespace-nowrap text-muted">{formatDateTime(a.created_at)}</Td>
                  <Td className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setSelected(a.id)}>
                      View
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  )
}

function ResultPanel({
  selected,
  detail,
  loading,
  error,
  retry,
}: {
  selected: number | null
  detail: AnalysisDetail | null
  loading: boolean
  error?: string
  retry: () => void
}) {
  const { path } = useWorkspace()

  if (!selected)
    return (
      <Card>
        <EmptyState title="No result yet" description="Upload a file to see detections here, or pick one from Recent analyses." />
      </Card>
    )
  if (loading) return <Card><Loading /></Card>
  if (!detail) return <Card><ErrorState message={error ?? ''} onRetry={retry} /></Card>

  const counts = BEHAVIOURS.filter((b) => (detail.behaviour_counts[b] ?? 0) > 0)

  return (
    <Card className="min-w-0">
      <CardHeader
        title={detail.original_name ?? `Analysis #${detail.id}`}
        description={`${detail.type === 'image' ? 'Image' : 'Video'} · ${formatDateTime(detail.created_at)}`}
        actions={<StatusBadge status={detail.status} />}
      />
      <CardBody className="flex flex-col gap-5">
        {detail.status === 'failed' && <Notice>{detail.error ?? 'The analysis failed.'}</Notice>}

        {(detail.status === 'queued' || detail.status === 'processing') && (
          <div>
            <div className="mb-1.5 flex justify-between text-sm">
              <span className="text-muted">{detail.status === 'queued' ? 'Waiting to start…' : 'Processing video…'}</span>
              <span className="tabular-nums">{Math.round(detail.progress)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-neutral-soft" role="progressbar" aria-valuenow={Math.round(detail.progress)} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-primary transition-[width]" style={{ width: `${detail.progress}%` }} />
            </div>
          </div>
        )}

        {detail.has_image && (
          <img
            src={analysisApi.imageUrl(detail.id)}
            alt={`Detection result for ${detail.original_name ?? 'the uploaded image'}`}
            className="w-full rounded-md border border-line"
          />
        )}

        {detail.status === 'done' && (
          <div>
            <p className="text-sm text-muted">
              {detail.detection_count === 0
                ? 'No cows were detected.'
                : `${detail.detection_count} detection${detail.detection_count === 1 ? '' : 's'}${detail.type === 'video' ? ' across sampled frames' : ''}.`}
            </p>
            {counts.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                {counts.map((b) => (
                  <li key={b} className="flex items-center gap-2">
                    <BehaviourBadge behaviour={b} />
                    <span className="text-sm text-muted tabular-nums">{detail.behaviour_counts[b as Behaviour]}</span>
                  </li>
                ))}
              </ul>
            )}
            {detail.type === 'video' && detail.detection_count > 0 && (
              <Link to={`${path('activity')}?analysis=${detail.id}`} className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
                See all detections in Activity logs
              </Link>
            )}
          </div>
        )}
      </CardBody>

      {detail.detections.length > 0 && (
        <Table label="Detections">
          <thead>
            <tr>
              {detail.type !== 'image' && <Th>Time</Th>}
              <Th>Behaviour</Th>
              <Th>Posture</Th>
              <Th>State</Th>
              <Th className="text-right">Confidence</Th>
            </tr>
          </thead>
          <tbody>
            {detail.detections.slice(0, 100).map((d) => (
              <tr key={d.id}>
                {detail.type !== 'image' && <Td className="whitespace-nowrap text-muted tabular-nums">{formatTime(d.frame_time)}</Td>}
                <Td>
                  <BehaviourBadge behaviour={d.behaviour} />
                </Td>
                <Td className="capitalize">{d.posture ?? '—'}</Td>
                <Td className="capitalize">{d.state ?? '—'}</Td>
                <Td className="text-right tabular-nums">{formatPercent(d.confidence)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  )
}
