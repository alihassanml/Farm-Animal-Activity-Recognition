import { Bell, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { errorMessage } from '../api/client'
import { alertApi } from '../api/endpoints'
import type { Alert, AlertRule, RuleType } from '../api/types'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, CardHeader } from '../components/ui/Card'
import { Input, Select, Toggle } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { EmptyState, ErrorState, Loading, Notice } from '../components/ui/States'
import { Table, Td, Th } from '../components/ui/Table'
import { Tabs } from '../components/ui/Tabs'
import { useWorkspace } from '../context/workspace'
import { useAsync, useInterval } from '../hooks/useAsync'
import { describeRule, RULE_LABEL } from '../lib/behaviour'
import { formatDateTime, formatRelative } from '../lib/format'

export default function Alerts() {
  return (
    <div className="flex flex-col gap-6">
      <AlertList />
      <RuleSettings />
    </div>
  )
}

function AlertList() {
  const { workspace } = useWorkspace()
  const [tab, setTab] = useState<'open' | 'acknowledged'>('open')
  const { data, error, loading, reload, mutate } = useAsync(() => alertApi.list(workspace.id), [workspace.id])
  useInterval(reload, 30_000)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [ackError, setAckError] = useState<string | null>(null)

  async function acknowledge(a: Alert) {
    setBusyId(a.id)
    setAckError(null)
    try {
      const updated = await alertApi.acknowledge(a.id)
      mutate((list) => list.map((x) => (x.id === a.id ? updated : x)))
    } catch (e) {
      setAckError(errorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  const open = data?.filter((a) => a.status === 'open') ?? []
  const acked = data?.filter((a) => a.status === 'acknowledged') ?? []
  const rows = tab === 'open' ? open : acked

  return (
    <Card>
      <div className="px-5 pt-2">
        <Tabs
          label="Alert status"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'open', label: 'Open', count: data ? open.length : undefined },
            { value: 'acknowledged', label: 'Acknowledged', count: data ? acked.length : undefined },
          ]}
        />
      </div>
      {ackError && (
        <div className="px-5 pt-4">
          <Notice>{ackError}</Notice>
        </div>
      )}
      {loading ? (
        <Loading />
      ) : !data ? (
        <ErrorState message={error ?? ''} onRetry={reload} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={tab === 'open' ? 'No open alerts' : 'No acknowledged alerts'}
          description={tab === 'open' ? 'Everything looks normal. New alerts appear here when a rule is triggered.' : undefined}
        />
      ) : (
        <Table label={tab === 'open' ? 'Open alerts' : 'Acknowledged alerts'}>
          <thead>
            <tr>
              <Th>Raised</Th>
              <Th>Camera</Th>
              <Th>Alert</Th>
              <Th>Severity</Th>
              <Th>{tab === 'open' ? <span className="sr-only">Actions</span> : 'Acknowledged'}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <Td className="whitespace-nowrap text-muted" title={formatDateTime(a.created_at)}>
                  {formatRelative(a.created_at)}
                </Td>
                <Td className="whitespace-nowrap">{a.camera_name ?? '—'}</Td>
                <Td>{a.message}</Td>
                <Td>
                  <Badge tone={a.severity === 'danger' ? 'danger' : 'warning'}>{a.severity === 'danger' ? 'High' : 'Medium'}</Badge>
                </Td>
                <Td className={tab === 'open' ? 'text-right' : 'text-sm text-muted'}>
                  {tab === 'open' ? (
                    <Button size="sm" variant="secondary" loading={busyId === a.id} onClick={() => acknowledge(a)}>
                      Acknowledge
                    </Button>
                  ) : (
                    <>
                      {a.acknowledged_by_name ?? 'Someone'}
                      {a.acknowledged_at && <span className="block text-xs">{formatDateTime(a.acknowledged_at)}</span>}
                    </>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  )
}

function RuleSettings() {
  const { workspace, isAdmin } = useWorkspace()
  const { data, error, loading, reload, mutate } = useAsync(() => alertApi.rules(workspace.id), [workspace.id])
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<AlertRule | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function update(rule: AlertRule, body: Partial<AlertRule>) {
    setActionError(null)
    try {
      const updated = await alertApi.updateRule(rule.id, body)
      mutate((list) => list.map((r) => (r.id === rule.id ? updated : r)))
    } catch (e) {
      setActionError(errorMessage(e))
    }
  }

  async function remove(rule: AlertRule) {
    setActionError(null)
    try {
      await alertApi.deleteRule(rule.id)
      mutate((list) => list.filter((r) => r.id !== rule.id))
    } catch (e) {
      setActionError(errorMessage(e))
    }
  }

  return (
    <Card>
      <CardHeader
        title="Alert rules"
        description="Checked every minute for each camera that is being monitored. Rules look at the whole herd in view, not individual cows."
        actions={
          isAdmin && (
            <Button size="sm" icon={<Plus className="size-4" aria-hidden />} onClick={() => setAdding(true)}>
              Add rule
            </Button>
          )
        }
      />
      {actionError && (
        <div className="px-5 pt-4">
          <Notice>{actionError}</Notice>
        </div>
      )}
      {loading ? (
        <Loading />
      ) : !data ? (
        <ErrorState message={error ?? ''} onRetry={reload} />
      ) : data.length === 0 ? (
        <EmptyState title="No rules" description={isAdmin ? 'Add a rule to get alerts.' : 'A workspace admin can add rules.'} />
      ) : (
        <Table label="Alert rules">
          <thead>
            <tr>
              <Th>Rule</Th>
              <Th>Condition</Th>
              <Th>Enabled</Th>
              {isAdmin && (
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              )}
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id}>
                <Td className="font-medium whitespace-nowrap">{RULE_LABEL[r.rule_type]}</Td>
                <Td className="text-muted">{describeRule(r.rule_type, r.threshold, r.window_minutes)}</Td>
                <Td>
                  {isAdmin ? (
                    <Toggle label={`Enable ${RULE_LABEL[r.rule_type]}`} checked={r.is_enabled} onChange={(v) => update(r, { is_enabled: v })} />
                  ) : (
                    <Badge tone={r.is_enabled ? 'success' : 'neutral'}>{r.is_enabled ? 'On' : 'Off'}</Badge>
                  )}
                </Td>
                {isAdmin && (
                  <Td>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" aria-label={`Delete ${RULE_LABEL[r.rule_type]} rule`} onClick={() => remove(r)}>
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {(adding || editing) && (
        <RuleForm
          rule={editing}
          onClose={() => {
            setAdding(false)
            setEditing(null)
          }}
          onSaved={() => {
            setAdding(false)
            setEditing(null)
            reload()
          }}
        />
      )}
    </Card>
  )
}

function RuleForm({ rule, onClose, onSaved }: { rule: AlertRule | null; onClose: () => void; onSaved: () => void }) {
  const { workspace } = useWorkspace()
  const [type, setType] = useState<RuleType>(rule?.rule_type ?? 'lying_ratio')
  const [threshold, setThreshold] = useState(String(rule?.threshold ?? 70))
  const [windowMin, setWindowMin] = useState(String(rule?.window_minutes ?? 60))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const w = Number(windowMin)
    const t = Number(threshold)
    if (!Number.isInteger(w) || w < 5) return setError('The time window must be at least 5 minutes.')
    if (type === 'lying_ratio' && (!(t >= 1) || t > 100)) return setError('The lying limit must be between 1 and 100%.')
    setBusy(true)
    setError(null)
    try {
      const thr = type === 'lying_ratio' ? t : null
      if (rule) await alertApi.updateRule(rule.id, { window_minutes: w, ...(thr !== null ? { threshold: thr } : {}) })
      else await alertApi.createRule(workspace.id, { rule_type: type, threshold: thr, window_minutes: w, is_enabled: true })
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      title={rule ? 'Edit rule' : 'Add rule'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="rule-form" loading={busy}>
            {rule ? 'Save rule' : 'Add rule'}
          </Button>
        </>
      }
    >
      <form id="rule-form" onSubmit={submit} className="flex flex-col gap-4">
        {error && <Notice>{error}</Notice>}
        <Select label="Rule" value={type} disabled={rule !== null} onChange={(e) => setType(e.target.value as RuleType)}>
          {(Object.keys(RULE_LABEL) as RuleType[]).map((k) => (
            <option key={k} value={k}>
              {RULE_LABEL[k]}
            </option>
          ))}
        </Select>
        {type === 'lying_ratio' && (
          <Input
            label="Lying limit (%)"
            type="number"
            min={1}
            max={100}
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            hint="Alert when at least this share of cow detections are lying."
          />
        )}
        <Input
          label="Time window (minutes)"
          type="number"
          min={5}
          step={5}
          value={windowMin}
          onChange={(e) => setWindowMin(e.target.value)}
          hint={type === 'lying_ratio' ? 'The share is measured over this window.' : `Alert when no ${type === 'no_foraging' ? 'foraging' : 'drinking'} is seen for this long.`}
        />
      </form>
    </Modal>
  )
}
