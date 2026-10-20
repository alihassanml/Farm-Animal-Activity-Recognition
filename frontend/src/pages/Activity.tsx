import { Download, ListChecks } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { cameraApi, detectionApi, type DetectionFilters } from '../api/endpoints'
import type { Behaviour } from '../api/types'
import { BehaviourBadge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { buttonClass } from '../components/ui/buttonStyles'
import { Card, CardBody } from '../components/ui/Card'
import { Input, Select } from '../components/ui/Field'
import { EmptyState, ErrorState, Loading } from '../components/ui/States'
import { Table, Td, Th } from '../components/ui/Table'
import { useWorkspace } from '../context/workspace'
import { useAsync } from '../hooks/useAsync'
import { BEHAVIOUR_LABEL, BEHAVIOURS } from '../lib/behaviour'
import { formatNumber, formatPercent, localInputToIso } from '../lib/format'

const PAGE_SIZE = 50

const dateTimeSeconds = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' })

export default function Activity() {
  const { workspace } = useWorkspace()
  const [params, setParams] = useSearchParams()

  // Filters live in the URL so they survive reloads and can be linked to.
  const applied = {
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
    camera: params.get('camera') ?? '',
    behaviour: params.get('behaviour') ?? '',
    analysis: params.get('analysis') ?? '',
  }
  const page = Math.max(0, Number(params.get('page') ?? 0) || 0)
  const [draft, setDraft] = useState(applied)

  const filters: DetectionFilters = {
    from: localInputToIso(applied.from),
    to: localInputToIso(applied.to),
    camera: applied.camera ? Number(applied.camera) : undefined,
    behaviour: (applied.behaviour || undefined) as Behaviour | undefined,
    analysis: applied.analysis ? Number(applied.analysis) : undefined,
  }

  const cameras = useAsync(() => cameraApi.list(workspace.id), [workspace.id])
  const result = useAsync(
    () => detectionApi.list(workspace.id, filters, PAGE_SIZE, page * PAGE_SIZE),
    [workspace.id, params.toString()],
  )
  const cameraName = new Map(cameras.data?.map((c) => [c.id, c.name]))

  function apply(e?: FormEvent) {
    e?.preventDefault()
    const next = new URLSearchParams()
    for (const [k, v] of Object.entries(draft)) if (v) next.set(k, v)
    setParams(next)
  }

  function clear() {
    const empty = { from: '', to: '', camera: '', behaviour: '', analysis: '' }
    setDraft(empty)
    setParams(new URLSearchParams())
  }

  function goTo(p: number) {
    const next = new URLSearchParams(params)
    if (p > 0) next.set('page', String(p))
    else next.delete('page')
    setParams(next)
  }

  const total = result.data?.total ?? 0
  const hasFilters = Object.values(applied).some(Boolean)

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardBody>
          <form onSubmit={apply} className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
            <Input label="From" type="datetime-local" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
            <Input label="To" type="datetime-local" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
            <Select label="Camera" value={draft.camera} onChange={(e) => setDraft({ ...draft, camera: e.target.value })}>
              <option value="">All cameras</option>
              {cameras.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select label="Behaviour" value={draft.behaviour} onChange={(e) => setDraft({ ...draft, behaviour: e.target.value })}>
              <option value="">All behaviours</option>
              {BEHAVIOURS.map((b) => (
                <option key={b} value={b}>
                  {BEHAVIOUR_LABEL[b]}
                </option>
              ))}
            </Select>
            <div className="flex gap-2">
              <Button type="submit">Apply</Button>
              {hasFilters && (
                <Button variant="secondary" onClick={clear}>
                  Clear
                </Button>
              )}
            </div>
          </form>
          {applied.analysis && (
            <p className="mt-3 text-sm text-muted">
              Showing detections from analysis #{applied.analysis} only.{' '}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => {
                  setDraft({ ...draft, analysis: '' })
                  const next = new URLSearchParams(params)
                  next.delete('analysis')
                  next.delete('page')
                  setParams(next)
                }}
              >
                Show all
              </button>
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
          <p className="text-sm text-muted">
            {result.data ? `${formatNumber(total)} detection${total === 1 ? '' : 's'}` : ' '}
          </p>
          <a
            href={detectionApi.exportUrl(workspace.id, filters)}
            className={buttonClass('secondary', 'sm')}
            download
            aria-disabled={total === 0}
            onClick={(e) => total === 0 && e.preventDefault()}
          >
            <Download className="size-4" aria-hidden />
            Export CSV
          </a>
        </div>

        {result.loading ? (
          <Loading />
        ) : !result.data ? (
          <ErrorState message={result.error ?? ''} onRetry={result.reload} />
        ) : result.data.items.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title={hasFilters ? 'No detections match these filters' : 'No activity logged yet'}
            description={hasFilters ? 'Try a wider time range or clear the filters.' : 'Detections from uploads and cameras are listed here.'}
          />
        ) : (
          <>
            <Table label="Activity log">
              <thead>
                <tr>
                  <Th>Time</Th>
                  <Th>Source</Th>
                  <Th>Behaviour</Th>
                  <Th>Posture</Th>
                  <Th>State</Th>
                  <Th className="text-right">Confidence</Th>
                </tr>
              </thead>
              <tbody>
                {result.data.items.map((d) => (
                  <tr key={d.id}>
                    <Td className="whitespace-nowrap text-muted tabular-nums">{dateTimeSeconds.format(new Date(d.frame_time))}</Td>
                    <Td className="whitespace-nowrap">
                      {d.camera_id ? (cameraName.get(d.camera_id) ?? `Camera #${d.camera_id}`) : `Upload #${d.analysis_id}`}
                    </Td>
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
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <p className="text-sm text-muted tabular-nums">
                {formatNumber(page * PAGE_SIZE + 1)}–{formatNumber(Math.min(total, (page + 1) * PAGE_SIZE))} of {formatNumber(total)}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => goTo(page - 1)}>
                  Previous
                </Button>
                <Button size="sm" variant="secondary" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => goTo(page + 1)}>
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
