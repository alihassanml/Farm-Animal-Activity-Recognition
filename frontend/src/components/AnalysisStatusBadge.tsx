import type { Analysis } from '../api/types'
import { Badge } from './ui/Badge'

const TONE = { queued: 'neutral', processing: 'primary', done: 'success', failed: 'danger' } as const
const LABEL = { queued: 'Queued', processing: 'Processing', done: 'Done', failed: 'Failed' }

export function StatusBadge({ status }: { status: Analysis['status'] }) {
  return <Badge tone={TONE[status]}>{LABEL[status]}</Badge>
}
