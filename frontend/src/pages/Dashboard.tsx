import { Bell, Cctv, PawPrint, ScanSearch } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { dashboardApi } from '../api/endpoints'
import type { Alert } from '../api/types'
import { Badge } from '../components/ui/Badge'
import { ButtonLink } from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { EmptyState, ErrorState, Loading } from '../components/ui/States'
import { StatCard } from '../components/ui/StatCard'
import { Table, Td, Th } from '../components/ui/Table'
import { useWorkspace } from '../context/workspace'
import { useAsync, useInterval } from '../hooks/useAsync'
import { BEHAVIOUR_COLOR, BEHAVIOUR_LABEL, BEHAVIOURS } from '../lib/behaviour'
import { formatHour, formatNumber, formatRelative } from '../lib/format'

const AXIS = { fontSize: 12, fill: '#5f6762' }
const TOOLTIP_STYLE = { borderRadius: 8, border: '1px solid #e3e6e4', fontSize: 13 }

export default function Dashboard() {
  const { workspace, path } = useWorkspace()
  const { data, error, loading, reload } = useAsync(() => dashboardApi.summary(workspace.id), [workspace.id])
  useInterval(reload, 30_000)

  if (loading) return <Loading />
  if (!data) return <ErrorState message={error ?? 'Unknown error'} onRetry={reload} />

  const totalToday = BEHAVIOURS.reduce((n, b) => n + data.behaviour_counts[b], 0)
  const bars = BEHAVIOURS.map((b) => ({ behaviour: BEHAVIOUR_LABEL[b], key: b, count: data.behaviour_counts[b] }))
  const lines = data.behaviour_over_time.map((t) => ({ time: formatHour(t.time), ...t.counts }))
  const hasTimeline = data.behaviour_over_time.some((t) => BEHAVIOURS.some((b) => t.counts[b] > 0))

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Cows detected today" value={formatNumber(data.peak_cows_today)} hint="Most cows seen together in one frame" icon={PawPrint} />
        <StatCard label="Active alerts" value={formatNumber(data.active_alerts)} hint="Open and not yet acknowledged" icon={Bell} />
        <StatCard label="Cameras online" value={`${data.cameras_online} / ${data.cameras_total}`} hint="Cameras being monitored now" icon={Cctv} />
        <StatCard label="Analyses run today" value={formatNumber(data.analyses_today)} hint="Images, videos and camera sessions" icon={ScanSearch} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_3fr]">
        <Card>
          <CardHeader title="Behaviour today" description={`${formatNumber(totalToday)} detections`} />
          <CardBody>
            {totalToday === 0 ? (
              <EmptyState
                title="No detections today"
                description="Analyze an image or video, or start a camera, to see behaviour here."
                action={
                  <ButtonLink to={path('analyze')} size="sm">
                    Analyze footage
                  </ButtonLink>
                }
              />
            ) : (
              <figure aria-label="Detections per behaviour today">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={bars} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid horizontal={false} stroke="#e3e6e4" />
                    <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="behaviour" tick={AXIS} tickLine={false} axisLine={{ stroke: '#e3e6e4' }} width={84} />
                    <Tooltip cursor={{ fill: '#f7f8f7' }} contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="count" name="Detections" radius={[0, 4, 4, 0]} maxBarSize={28}>
                      {bars.map((b) => (
                        <Cell key={b.key} fill={BEHAVIOUR_COLOR[b.key]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </figure>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Behaviour over the last 24 hours" description="Detections per hour" />
          <CardBody>
            {!hasTimeline ? (
              <EmptyState title="No activity in the last 24 hours" />
            ) : (
              <figure aria-label="Detections per hour by behaviour, last 24 hours">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={lines} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#e3e6e4" />
                    <XAxis dataKey="time" tick={AXIS} tickLine={false} axisLine={{ stroke: '#e3e6e4' }} minTickGap={24} />
                    <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13 }} itemSorter={null} />
                    {BEHAVIOURS.map((b) => (
                      <Line key={b} type="monotone" dataKey={b} name={BEHAVIOUR_LABEL[b]} stroke={BEHAVIOUR_COLOR[b]} strokeWidth={2} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </figure>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Recent alerts"
          actions={
            <Link to={path('alerts')} className="text-sm font-medium text-primary hover:underline">
              View all alerts
            </Link>
          }
        />
        {data.recent_alerts.length === 0 ? (
          <EmptyState icon={Bell} title="No alerts yet" description="Alerts appear here when a rule is triggered on a monitored camera." />
        ) : (
          <AlertTable alerts={data.recent_alerts} />
        )}
      </Card>
    </div>
  )
}

function AlertTable({ alerts }: { alerts: Alert[] }) {
  return (
    <Table label="Recent alerts">
      <thead>
        <tr>
          <Th>When</Th>
          <Th>Camera</Th>
          <Th>Alert</Th>
          <Th>Status</Th>
        </tr>
      </thead>
      <tbody>
        {alerts.map((a) => (
          <tr key={a.id}>
            <Td className="whitespace-nowrap text-muted">{formatRelative(a.created_at)}</Td>
            <Td className="whitespace-nowrap">{a.camera_name ?? '—'}</Td>
            <Td>{a.message}</Td>
            <Td>
              {a.status === 'open' ? <Badge tone={a.severity === 'danger' ? 'danger' : 'warning'}>Open</Badge> : <Badge>Acknowledged</Badge>}
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}
