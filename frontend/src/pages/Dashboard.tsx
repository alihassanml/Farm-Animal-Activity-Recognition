import { ArrowRight, Bell, Cctv, Check, PawPrint, ScanSearch, Video, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { cameraApi, dashboardApi } from '../api/endpoints'
import type { Alert, Camera, DashboardSummary } from '../api/types'
import { Badge } from '../components/ui/Badge'
import { ButtonLink } from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { EmptyState, ErrorState, Loading } from '../components/ui/States'
import { StatCard } from '../components/ui/StatCard'
import { useAuth } from '../context/auth'
import { useWorkspace } from '../context/workspace'
import { useAsync, useInterval } from '../hooks/useAsync'
import { BEHAVIOUR_COLOR, BEHAVIOUR_LABEL, BEHAVIOURS } from '../lib/behaviour'
import { formatHour, formatNumber, formatRelative } from '../lib/format'
import { getFlag, setFlag } from '../lib/storage'

const AXIS = { fontSize: 12, fill: '#5f6762' }
const TOOLTIP_STYLE = { borderRadius: 8, border: '1px solid #e3e6e4', fontSize: 13, boxShadow: '0 8px 24px -8px rgb(16 24 20 / 0.15)' }

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0)

export default function Dashboard() {
  const { workspace, path, isAdmin } = useWorkspace()
  const { me } = useAuth()
  const summary = useAsync(() => dashboardApi.summary(workspace.id), [workspace.id])
  const cameras = useAsync(() => cameraApi.list(workspace.id), [workspace.id])
  useInterval(() => {
    summary.reload()
    cameras.reload()
  }, 30_000)

  const data = summary.data
  if (summary.loading) return <Loading />
  if (!data) return <ErrorState message={summary.error ?? 'Unknown error'} onRetry={summary.reload} />

  const totalToday = BEHAVIOURS.reduce((n, b) => n + data.behaviour_counts[b], 0)
  const firstName = me?.user.name.split(' ')[0] ?? ''

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[24px] tracking-[-0.01em]">
            {greeting()}
            {firstName && `, ${firstName}`}
          </h2>
          <p className="mt-1 text-muted">Here’s how the herd at {workspace.name} is doing today.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink to={path('cameras')} variant="secondary" size="sm">
            <Video className="size-4" aria-hidden />
            Cameras
          </ButtonLink>
          <ButtonLink to={path('analyze')} size="sm">
            <ScanSearch className="size-4" aria-hidden />
            Analyze footage
          </ButtonLink>
        </div>
      </div>

      <GettingStarted key={workspace.id} data={data} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Cows detected today" value={formatNumber(data.peak_cows_today)} hint="Most cows seen together in one frame" icon={PawPrint} />
        <StatCard
          label="Active alerts"
          value={formatNumber(data.active_alerts)}
          hint={data.active_alerts > 0 ? 'Needs your attention' : 'Everything looks normal'}
          icon={Bell}
          tone={data.active_alerts > 0 ? 'danger' : 'neutral'}
          to={path('alerts')}
        />
        <StatCard
          label="Cameras online"
          value={
            <>
              {data.cameras_online}
              <span className="text-lg font-medium text-muted"> / {data.cameras_total}</span>
            </>
          }
          hint={data.cameras_total === 0 ? 'No cameras added yet' : 'Being monitored right now'}
          icon={Cctv}
          tone={data.cameras_online > 0 ? 'success' : 'neutral'}
          to={path('cameras')}
        />
        <StatCard label="Analyses run today" value={formatNumber(data.analyses_today)} hint="Images, videos and camera sessions" icon={ScanSearch} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader title="Today’s herd activity" description={`${formatNumber(totalToday)} detections since midnight`} />
          <CardBody>
            {totalToday === 0 ? (
              <EmptyState
                title="No detections today"
                description="Analyze an image or video, or start a camera, to see the herd’s activity here."
                action={
                  <ButtonLink to={path('analyze')} size="sm">
                    Analyze footage
                  </ButtonLink>
                }
              />
            ) : (
              <BehaviourBreakdown data={data} total={totalToday} />
            )}
          </CardBody>
        </Card>
        <HerdSignals data={data} total={totalToday} />
      </div>

      <Card>
        <CardHeader title="Activity over the last 24 hours" description="Detections per completed hour, by behaviour" />
        <CardBody>
          <ActivityChart data={data} />
        </CardBody>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Recent alerts"
            actions={
              <Link to={path('alerts')} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                View all <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            }
          />
          {data.recent_alerts.length === 0 ? (
            <EmptyState icon={Bell} title="No alerts yet" description="Alerts appear here when a rule is triggered on a monitored camera." />
          ) : (
            <ul className="divide-y divide-line">
              {data.recent_alerts.map((a) => (
                <AlertItem key={a.id} alert={a} />
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Cameras"
            actions={
              <Link to={path('cameras')} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                Manage <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            }
          />
          {!cameras.data ? (
            cameras.loading ? <Loading /> : <ErrorState message={cameras.error ?? ''} onRetry={cameras.reload} />
          ) : cameras.data.length === 0 ? (
            <EmptyState
              icon={Video}
              title="No cameras yet"
              description="Connect a webcam or CCTV camera to monitor the herd continuously."
              action={
                isAdmin && (
                  <ButtonLink to={path('cameras')} size="sm">
                    Add camera
                  </ButtonLink>
                )
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {cameras.data.slice(0, 6).map((c) => (
                <CameraItem key={c.id} camera={c} />
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

function GettingStarted({ data }: { data: DashboardSummary }) {
  const { workspace, path } = useWorkspace()
  const key = `setupDismissed.${workspace.id}`
  const [dismissed, setDismissed] = useState(() => getFlag(key))

  const steps = [
    { done: data.analyses_total > 0, title: 'Analyze your first image or video', text: 'See how the model labels each cow.', to: path('analyze'), cta: 'Analyze' },
    { done: data.cameras_total > 0, title: 'Add a camera', text: 'Monitor the barn around the clock.', to: path('cameras'), cta: 'Add camera' },
    { done: data.members_total > 1, title: 'Invite your team', text: 'Share alerts with farm staff and your vet.', to: path('settings'), cta: 'Invite' },
  ]
  const doneCount = steps.filter((s) => s.done).length
  if (dismissed || doneCount === steps.length) return null

  return (
    <Card>
      <div className="flex items-start justify-between gap-4 px-5 pt-4">
        <div>
          <h3 className="text-base font-semibold">Get your workspace ready</h3>
          <p className="mt-0.5 text-sm text-muted">
            {doneCount} of {steps.length} done
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFlag(key)
            setDismissed(true)
          }}
          className="rounded-md p-1 text-muted hover:bg-neutral-soft hover:text-ink"
          aria-label="Hide setup steps"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="mx-5 mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-soft">
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <ol className="grid gap-px p-2 sm:grid-cols-3">
        {steps.map((s) => (
          <li key={s.title} className="flex items-start gap-3 rounded-md p-3">
            <span
              className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${s.done ? 'bg-primary text-white' : 'border border-line-strong text-transparent'}`}
              aria-hidden
            >
              <Check className="size-3.5" strokeWidth={3} />
            </span>
            <div className="min-w-0">
              <p className={`font-medium ${s.done ? 'text-muted line-through' : ''}`}>{s.title}</p>
              <p className="text-sm text-muted">{s.text}</p>
              {!s.done && (
                <Link to={s.to} className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                  {s.cta} <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              )}
              <span className="sr-only">{s.done ? '(done)' : '(not done)'}</span>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  )
}

function BehaviourBreakdown({ data, total }: { data: DashboardSummary; total: number }) {
  const rows = BEHAVIOURS.map((b) => ({ b, n: data.behaviour_counts[b] })).sort((x, y) => y.n - x.n)
  return (
    <div>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Share of detections per behaviour today">
        {rows
          .filter((r) => r.n > 0)
          .map(({ b, n }) => (
            <div key={b} style={{ width: `${(n / total) * 100}%`, backgroundColor: BEHAVIOUR_COLOR[b] }} />
          ))}
      </div>
      <table className="mt-5 w-full text-sm">
        <caption className="sr-only">Detections per behaviour today</caption>
        <thead>
          <tr className="text-left text-xs font-medium text-muted">
            <th scope="col" className="pb-2 font-medium">Behaviour</th>
            <th scope="col" className="pb-2 text-right font-medium">Detections</th>
            <th scope="col" className="w-2/5 pb-2 pl-6 font-medium">Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ b, n }) => (
            <tr key={b} className="border-t border-line">
              <td className="py-2.5">
                <span className="flex items-center gap-2.5">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: BEHAVIOUR_COLOR[b] }} aria-hidden />
                  {BEHAVIOUR_LABEL[b]}
                </span>
              </td>
              <td className="py-2.5 text-right tabular-nums">{formatNumber(n)}</td>
              <td className="py-2.5 pl-6">
                <span className="flex items-center gap-3">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-soft">
                    <span className="block h-full rounded-full" style={{ width: `${pct(n, total)}%`, backgroundColor: BEHAVIOUR_COLOR[b] }} />
                  </span>
                  <span className="w-9 text-right text-muted tabular-nums">{pct(n, total)}%</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function HerdSignals({ data, total }: { data: DashboardSummary; total: number }) {
  const c = data.behaviour_counts
  const shares = [
    { label: 'Lying', value: pct(c.lying, total), color: BEHAVIOUR_COLOR.lying, note: 'of detections today' },
    { label: 'Eating', value: pct(c.foraging, total), color: BEHAVIOUR_COLOR.foraging, note: 'of detections today' },
  ]
  const lastSeen = [
    { label: 'Last drinking seen', at: data.last_seen.drinking },
    { label: 'Last eating seen', at: data.last_seen.foraging },
    { label: 'Last rumination seen', at: data.last_seen.rumination },
  ]
  return (
    <Card>
      <CardHeader title="Herd signals" description="Quick health indicators from today’s detections" />
      <CardBody className="flex flex-col gap-5">
        {shares.map((s) => (
          <div key={s.label}>
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-medium">{s.label}</p>
              <p className="text-sm">
                <span className="text-lg font-semibold tabular-nums">{s.value}%</span>{' '}
                <span className="text-muted">{s.note}</span>
              </p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-soft">
              <div className="h-full rounded-full" style={{ width: `${s.value}%`, backgroundColor: s.color }} />
            </div>
          </div>
        ))}
        <dl className="mt-1 divide-y divide-line border-t border-line">
          {lastSeen.map((r) => (
            <div key={r.label} className="flex items-center justify-between py-2.5 text-sm">
              <dt className="text-muted">{r.label}</dt>
              <dd className="font-medium">{r.at ? formatRelative(r.at) : 'Not yet'}</dd>
            </div>
          ))}
        </dl>
      </CardBody>
    </Card>
  )
}

/** Hourly buckets, without the hour still in progress (a partial hour would look like a sudden drop). */
function completeHours(data: DashboardSummary) {
  const buckets = data.behaviour_over_time
  const last = buckets[buckets.length - 1]
  const inProgress = last && Date.now() - new Date(last.time).getTime() < 3_600_000
  return inProgress ? buckets.slice(0, -1) : buckets
}

function ActivityChart({ data }: { data: DashboardSummary }) {
  const buckets = completeHours(data)
  const rows = buckets.map((t) => ({ time: formatHour(t.time), ...t.counts }))
  const hasData = buckets.some((t) => BEHAVIOURS.some((b) => t.counts[b] > 0))
  if (!hasData) return <EmptyState title="No activity in the last 24 hours" description="The chart fills in as cameras and uploads add detections." />
  return (
    <div>
      <ul className="mb-4 flex flex-wrap gap-x-5 gap-y-2" aria-hidden>
        {BEHAVIOURS.map((b) => (
          <li key={b} className="flex items-center gap-2 text-sm text-muted">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: BEHAVIOUR_COLOR[b] }} />
            {BEHAVIOUR_LABEL[b]}
          </li>
        ))}
      </ul>
      <figure aria-label="Detections per hour by behaviour over the last 24 hours">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={rows} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e3e6e4" />
            <XAxis dataKey="time" tick={AXIS} tickLine={false} axisLine={false} minTickGap={28} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            {BEHAVIOURS.map((b) => (
              <Area
                key={b}
                type="monotone"
                dataKey={b}
                name={BEHAVIOUR_LABEL[b]}
                stackId="herd"
                stroke="#ffffff"
                strokeWidth={1.5}
                fill={BEHAVIOUR_COLOR[b]}
                fillOpacity={0.88}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </figure>
    </div>
  )
}

function AlertItem({ alert: a }: { alert: Alert }) {
  const open = a.status === 'open'
  const danger = a.severity === 'danger'
  return (
    <li className="flex items-start gap-3 px-5 py-3.5">
      <span
        className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${
          !open ? 'bg-neutral-soft text-muted' : danger ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning'
        }`}
      >
        <Bell className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${open ? 'font-medium text-ink' : 'text-muted'}`}>{a.message}</p>
        <p className="mt-0.5 text-xs text-muted">
          {a.camera_name ?? 'Camera'} · {formatRelative(a.created_at)}
        </p>
      </div>
      {open ? <Badge tone={danger ? 'danger' : 'warning'}>{danger ? 'High' : 'Medium'}</Badge> : <Badge>Acknowledged</Badge>}
    </li>
  )
}

const CAMERA_STATE: Record<Camera['status'], { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  running: { label: 'Live', tone: 'success' },
  connecting: { label: 'Connecting', tone: 'warning' },
  error: { label: 'Error', tone: 'danger' },
  stopped: { label: 'Stopped', tone: 'neutral' },
}

function CameraItem({ camera: c }: { camera: Camera }) {
  const s = CAMERA_STATE[c.status]
  return (
    <li className="flex items-center gap-3 px-5 py-3.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
        <Video className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{c.name}</p>
        <p className="truncate text-xs text-muted">{c.location ?? (c.source.match(/^\d+$/) ? `Webcam ${c.source}` : 'Network camera')}</p>
      </div>
      <Badge tone={s.tone}>
        {s.tone === 'success' && <span className="size-1.5 rounded-full bg-success" aria-hidden />}
        {s.label}
      </Badge>
    </li>
  )
}
