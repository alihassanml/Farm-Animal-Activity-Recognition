import { Pencil, Play, Plus, Square, Trash2, Video } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { errorMessage } from '../api/client'
import { cameraApi } from '../api/endpoints'
import type { Camera, CameraStatus } from '../api/types'
import { ModelStatus } from '../components/ModelStatus'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, PageToolbar } from '../components/ui/Card'
import { Input } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { EmptyState, ErrorState, Loading, Notice } from '../components/ui/States'
import { Table, Td, Th } from '../components/ui/Table'
import { useWorkspace } from '../context/workspace'
import { useAsync, useInterval } from '../hooks/useAsync'

const STATUS: Record<CameraStatus, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  running: { label: 'Live', tone: 'success' },
  connecting: { label: 'Connecting', tone: 'warning' },
  error: { label: 'Error', tone: 'danger' },
  stopped: { label: 'Stopped', tone: 'neutral' },
}

export default function Cameras() {
  const { workspace, isAdmin } = useWorkspace()
  const { data, error, loading, reload, mutate } = useAsync(() => cameraApi.list(workspace.id), [workspace.id])
  useInterval(reload, 5000)

  const [editing, setEditing] = useState<Camera | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Camera | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function toggle(c: Camera) {
    setBusyId(c.id)
    setActionError(null)
    try {
      const updated = c.is_active ? await cameraApi.stop(c.id) : await cameraApi.start(c.id)
      mutate((list) => list.map((x) => (x.id === c.id ? updated : x)))
    } catch (e) {
      setActionError(errorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <ModelStatus />
      <PageToolbar
        description="Cameras are sampled once per second while monitoring is on. Detections go to the activity log and are checked against your alert rules."
        actions={
          isAdmin && (
            <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setEditing('new')}>
              Add camera
            </Button>
          )
        }
      />
      {actionError && (
        <div className="mb-4">
          <Notice>{actionError}</Notice>
        </div>
      )}

      <Card>
        {loading ? (
          <Loading />
        ) : !data ? (
          <ErrorState message={error ?? ''} onRetry={reload} />
        ) : data.length === 0 ? (
          <EmptyState
            icon={Video}
            title="No cameras yet"
            description={isAdmin ? 'Add a USB webcam or an RTSP camera to start monitoring.' : 'Ask a workspace admin to add a camera.'}
            action={isAdmin && <Button onClick={() => setEditing('new')}>Add camera</Button>}
          />
        ) : (
          <Table label="Cameras">
            <thead>
              <tr>
                <Th>Camera</Th>
                <Th>Source</Th>
                <Th>Status</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id}>
                  <Td>
                    <p className="font-medium">{c.name}</p>
                    {c.location && <p className="text-sm text-muted">{c.location}</p>}
                  </Td>
                  <Td className="max-w-72 truncate font-mono text-[13px] text-muted">{c.source.match(/^\d+$/) ? `Webcam ${c.source}` : c.source}</Td>
                  <Td>
                    <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge>
                    {c.last_error && <p className="mt-1 text-xs text-danger">{c.last_error}</p>}
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant={c.is_active ? 'secondary' : 'primary'}
                        icon={c.is_active ? <Square className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
                        loading={busyId === c.id}
                        onClick={() => toggle(c)}
                      >
                        {c.is_active ? 'Stop' : 'Start'}
                      </Button>
                      {isAdmin && (
                        <>
                          <Button size="sm" variant="ghost" aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)}>
                            <Pencil className="size-4" aria-hidden />
                          </Button>
                          <Button size="sm" variant="ghost" aria-label={`Delete ${c.name}`} onClick={() => setDeleting(c)}>
                            <Trash2 className="size-4" aria-hidden />
                          </Button>
                        </>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {editing && (
        <CameraForm
          camera={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
        />
      )}
      <ConfirmDelete camera={deleting} onClose={() => setDeleting(null)} onDeleted={() => { setDeleting(null); reload() }} />
    </div>
  )
}

function CameraForm({ camera, onClose, onSaved }: { camera: Camera | null; onClose: () => void; onSaved: () => void }) {
  const { workspace } = useWorkspace()
  const [name, setName] = useState(camera?.name ?? '')
  const [source, setSource] = useState(camera?.source ?? '')
  const [location, setLocation] = useState(camera?.location ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const body = { name, source, location: location.trim() || null }
    try {
      if (camera) await cameraApi.update(camera.id, body)
      else await cameraApi.create(workspace.id, body)
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
          <Button type="submit" form="camera-form" loading={busy} disabled={!name.trim() || !source.trim()}>
            {camera ? 'Save changes' : 'Add camera'}
          </Button>
        </>
      }
    >
      <form id="camera-form" onSubmit={submit} className="flex flex-col gap-4">
        {error && <Notice>{error}</Notice>}
        <Input label="Name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Barn A – feed lane" />
        <Input
          label="Source"
          required
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="0 or rtsp://user:pass@192.168.1.20/stream"
          hint="A webcam index on the server (0, 1, …) or an RTSP / HTTP stream URL."
        />
        <Input label="Location (optional)" maxLength={200} value={location} onChange={(e) => setLocation(e.target.value)} />
      </form>
    </Modal>
  )
}

function ConfirmDelete({ camera, onClose, onDeleted }: { camera: Camera | null; onClose: () => void; onDeleted: () => void }) {
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
