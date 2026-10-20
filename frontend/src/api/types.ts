// Mirrors backend/app/schemas.py

export type Role = 'admin' | 'member'
export type Behaviour = 'standing' | 'lying' | 'foraging' | 'drinking' | 'rumination'

export interface User {
  id: number
  name: string
  email: string
  created_at: string
}

export interface WorkspaceSummary {
  id: number
  name: string
  role: Role
}

export interface Me {
  user: User
  workspaces: WorkspaceSummary[]
}

export interface Workspace extends WorkspaceSummary {
  created_at: string
}

export interface Member {
  user_id: number
  name: string
  email: string
  role: Role
  joined_at: string
}

export interface Invite {
  id: number
  email: string
  role: Role
  token: string
  status: string
  expires_at: string
  created_at: string
}

export interface InvitePublic {
  workspace_name: string
  email: string
  role: Role
  status: 'pending' | 'accepted' | 'revoked' | 'expired'
}

export type AnalysisStatus = 'queued' | 'processing' | 'done' | 'failed'

export interface Analysis {
  id: number
  camera_id: number | null
  type: 'image' | 'video' | 'camera'
  original_name: string | null
  status: AnalysisStatus
  progress: number
  error: string | null
  detection_count: number
  has_image: boolean
  created_at: string
  finished_at: string | null
}

export interface Detection {
  id: number
  analysis_id: number
  camera_id: number | null
  frame_index: number
  frame_time: string
  posture: string | null
  state: string | null
  behaviour: Behaviour
  confidence: number
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface AnalysisDetail extends Analysis {
  behaviour_counts: Partial<Record<Behaviour, number>>
  detections: Detection[]
}

export interface DetectionPage {
  items: Detection[]
  total: number
}

export type CameraStatus = 'stopped' | 'connecting' | 'running' | 'error'

export interface Camera {
  id: number
  name: string
  source: string
  location: string | null
  is_active: boolean
  status: CameraStatus
  last_error: string | null
  created_at: string
}

export interface CameraInput {
  name: string
  source: string
  location: string | null
}

export interface Animal {
  id: number
  tag_id: string
  name: string | null
  breed: string | null
  age_months: number | null
  notes: string | null
  created_at: string
}

export type AnimalInput = Omit<Animal, 'id' | 'created_at'>

export type RuleType = 'lying_ratio' | 'no_foraging' | 'no_drinking'

export interface AlertRule {
  id: number
  rule_type: RuleType
  threshold: number | null
  window_minutes: number
  is_enabled: boolean
}

export interface Alert {
  id: number
  camera_id: number | null
  camera_name: string | null
  rule_id: number | null
  message: string
  severity: 'warning' | 'danger'
  status: 'open' | 'acknowledged'
  acknowledged_by_name: string | null
  acknowledged_at: string | null
  created_at: string
}

export interface DashboardSummary {
  peak_cows_today: number
  active_alerts: number
  cameras_online: number
  cameras_total: number
  analyses_today: number
  behaviour_counts: Record<Behaviour, number>
  behaviour_over_time: { time: string; counts: Record<Behaviour, number> }[]
  recent_alerts: Alert[]
}

export interface Health {
  status: string
  model_loaded: boolean
  model_mode: 'single' | 'dual'
  model_error: string | null
}
