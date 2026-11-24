import { ArrowRight, Bell, ScanSearch, Video } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { cameraApi, dashboardApi } from '../api/endpoints'
import type { Alert, Camera, DashboardSummary } from '../api/types'
import { Badge, BehaviourBadge, Swatch } from '../components/ui/Badge'
import { ButtonLink } from '../components/ui/Button'
import { Card, CardBody, CardHeader, PageHeader } from '../components/ui/Card'
import { CompositionBar, ShareBar, Sparkline } from '../components/ui/DataViz'
import { EmptyState, ErrorState, Loading } from '../components/ui/States'
import { StatCard } from '../components/ui/StatCard'
import { useAuth } from '../context/auth'
import { useWorkspace } from '../context/workspace'
import { useAsync, useInterval } from '../hooks/useAsync'
import { BEHAVIOUR_COLOR, BEHAVIOUR_LABEL, BEHAVIOURS } from '../lib/behaviour'
import { KIND_LABEL } from '../lib/camera'
import { formatHour, formatNumber, formatRelative } from '../lib/format'

// Chart styling from tokens: muted mono ticks, thin gray gridlines, flat tooltip.
const AXIS = { fontSize: 13, fill: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }
const TOOLTIP_STYLE = {
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-line)',
  boxShadow: 'var(--shadow-overlay)',
  fontSize: 13,
  padding: 'var(--space-3)',
}
const TOOLTIP_ITEM = { fontFamily: 'var(--font-mono)', color: 'var(--color-ink)', padding: 0 }
const TOOLTIP_LABEL = { color: 'var(--color-muted)', fontFamily: 'var(--font-mono)', marginBottom: 'var(--space-1)' }
const LINK = 'inline-flex items-center gap-1 text-sm text-secondary transition-colors duration-150 hover:text-ink'

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

  const hourly = completeHours(data).map((t) => BEHAVIOURS.reduce((n, b) => n + t.counts[b], 0))

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`${greeting()}${firstName ? `, ${firstName}` : ''}. Here’s how the herd at ${workspace.name} is doing today.`}
        actions={
          <>
            <ButtonLink to={path('cameras')} variant="secondary">
              <Video className="size-4" strokeWidth={1.75} aria-hidden />
              Cameras
            </ButtonLink>
            <ButtonLink to={path('analyze')}>
              <ScanSearch className="size-4" strokeWidth={1.75} aria-hidden />
              Analyze footage
            </ButtonLink>
          </>
        }
      />

      <div className="flex flex-col gap-6">
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Cows detected today" value={formatNumber(data.peak_cows_today)} hint="Most cows seen together in one frame">
          {hourly.some((n) => n > 0) && <Sparkline values={hourly} label="Detections per hour, last 24 hours" />}
        </StatCard>
        <StatCard
          label="Active alerts"
          value={formatNumber(data.active_alerts)}
          hint={data.active_alerts > 0 ? 'Needs your attention' : 'Everything looks normal'}
          tone={data.active_alerts > 0 ? 'danger' : 'success'}
          to={path('alerts')}
        />
        <StatCard
          label="Cameras online"
          value={
            <>
              {data.cameras_online}
              <span className="text-muted"> / {data.cameras_total}</span>
            </>
          }
          hint={data.cameras_total === 0 ? 'No cameras added yet' : 'Being monitored right now'}
          tone={data.cameras_online > 0 ? 'success' : 'neutral'}
          to={path('cameras')}
        />
        <StatCard label="Analyses run today" value={formatNumber(data.analyses_today)} hint="Images, videos and camera sessions" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader title="Today’s herd activity" description={`${formatNumber(totalToday)} camera detections since midnight`} />
          <CardBody>
            {totalToday === 0 ? (
              <EmptyState
                title="No camera activity today"
                description="Start monitoring a camera to see the herd’s activity here. Results of uploaded images and videos are on the Analyze page."
                action={
                  <ButtonLink to={path('cameras')} size="sm">
                    Go to cameras
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
              <Link to={path('alerts')} className={LINK}>
                View all <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            }
          />
          {data.recent_alerts.length === 0 ? (
            <EmptyState icon={Bell} title="No alerts yet" description="Alerts appear here when a rule is triggered on a monitored camera." />
          ) : (
            <ul className="border-t border-line">
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
              <Link to={path('cameras')} className={LINK}>
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
            <ul className="border-t border-line">
              {cameras.data.slice(0, 6).map((c) => (
                <CameraItem key={c.id} camera={c} />
              ))}
            </ul>
          )}
        </Card>
      </div>
      </div>
    </div>
  )
}

function BehaviourBreakdown({ data, total }: { data: DashboardSummary; total: number }) {
  const rows = BEHAVIOURS.map((b) => ({ b, n: data.behaviour_counts[b] })).sort((x, y) => y.n - x.n)
  return (
    <div>
      <CompositionBar parts={rows} label="Share of detections per behaviour today" />
      <table className="mt-6 w-full text-sm">
        <caption className="sr-only">Detections per behaviour today</caption>
        <thead>
          <tr className="text-left text-xs text-muted">
            <th scope="col" className="pb-2 font-normal">Behaviour</th>
            <th scope="col" className="pb-2 text-right font-normal">Detections</th>
            <th scope="col" className="w-2/5 pb-2 pl-6 font-normal">Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ b, n }) => (
            <tr key={b} className="border-t border-line">
              <td className="py-3">
                <BehaviourBadge behaviour={b} />
              </td>
              <td className="numeric py-3 text-right">{formatNumber(n)}</td>
              <td className="py-3 pl-6">
                <span className="flex items-center gap-3">
                  <ShareBar behaviour={b} percent={pct(n, total)} />
                  <span className="numeric w-12 text-right text-muted">{pct(n, total)}%</span>
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
    { label: 'Lying', b: 'lying' as const, value: pct(c.lying, total), note: 'of detections today' },
    { label: 'Eating', b: 'foraging' as const, value: pct(c.foraging, total), note: 'of detections today' },
  ]
  const lastSeen = [
    { label: 'Last drinking seen', at: data.last_seen.drinking },
    { label: 'Last eating seen', at: data.last_seen.foraging },
  ]
  return (
    <Card>
      <CardHeader title="Herd signals" description="Quick health indicators from today’s detections" />
      <CardBody className="flex flex-col gap-6">
        {shares.map((s) => (
          <div key={s.label}>
            <div className="flex items-baseline justify-between gap-4">
              <p className="flex items-center gap-2 text-sm text-ink">
                <Swatch behaviour={s.b} />
                {s.label}
              </p>
              <p className="text-sm text-muted">
                <span className="numeric text-base text-ink">{s.value}%</span> {s.note}
              </p>
            </div>
            <div className="mt-3 flex">
              <ShareBar behaviour={s.b} percent={s.value} />
            </div>
          </div>
        ))}
        <dl className="border-t border-line">
          {lastSeen.map((r) => (
            <div key={r.label} className="flex items-center justify-between border-b border-line py-3 text-sm last:border-b-0">
              <dt className="text-secondary">{r.label}</dt>
              <dd className="numeric text-ink">{r.at ? formatRelative(r.at) : 'Not yet'}</dd>
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
  if (!hasData) return <EmptyState title="No activity in the last 24 hours" description="The chart fills in while cameras are being monitored." />
  return (
    <div>
      <ul className="mb-6 flex flex-wrap gap-x-6 gap-y-2" aria-hidden>
        {BEHAVIOURS.map((b) => (
          <li key={b}>
            <BehaviourBadge behaviour={b} />
          </li>
        ))}
      </ul>
      <figure aria-label="Detections per hour by behaviour over the last 24 hours">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={rows} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--color-line)" />
            <XAxis dataKey="time" tick={AXIS} tickLine={false} axisLine={{ stroke: 'var(--color-line)' }} minTickGap={32} tickMargin={8} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} tickMargin={8} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              itemStyle={TOOLTIP_ITEM}
              labelStyle={TOOLTIP_LABEL}
              cursor={{ stroke: 'var(--color-line-strong)' }}
            />
            {BEHAVIOURS.map((b) => (
              <Area
                key={b}
                type="monotone"
                dataKey={b}
                name={BEHAVIOUR_LABEL[b]}
                stackId="herd"
                stroke="var(--color-white)"
                strokeWidth={1}
                fill={BEHAVIOUR_COLOR[b]}
                fillOpacity={1}
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
    <li className="flex items-start gap-4 border-b border-line px-6 py-4 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${open ? 'text-ink' : 'text-secondary'}`}>{a.message}</p>
        <p className="mt-1 text-xs text-muted">
          {a.camera_name ?? 'Camera'} · <span className="numeric">{formatRelative(a.created_at)}</span>
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
  const { path } = useWorkspace()
  const s = CAMERA_STATE[c.status]
  return (
    <li className="border-b border-line last:border-b-0">
      <Link to={path(`cameras/${c.id}`)} className="flex items-center gap-4 px-6 py-4 transition-colors duration-150 hover:bg-surface-alt">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-ink">{c.name}</p>
          <p className="truncate text-xs text-muted">{c.location ?? KIND_LABEL[c.kind]}</p>
        </div>
        <span className={`text-xs ${s.tone === 'danger' ? 'text-critical' : 'text-secondary'}`}>{s.label}</span>
      </Link>
    </li>
  )
}
