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
  track_id: number | null
  posture: string | null
  state: string | null
  behaviour: Behaviour
  confidence: number
  x1: number
  y1: number
  x2: number
  y2: number
}

/** One tracked cow within an analysis (IDs are numbered per video / camera session). */
export interface CowSummary {
  track_id: number
  first_seen: string
  last_seen: string
  detections: number
  behaviour_counts: Partial<Record<Behaviour, number>>
  main_behaviour: Behaviour
}

export interface AnalysisDetail extends Analysis {
  behaviour_counts: Partial<Record<Behaviour, number>>
  cow_count: number
  cows: CowSummary[]
  detections: Detection[]
}

export interface DetectionPage {
  items: Detection[]
  total: number
}

export type CameraStatus = 'stopped' | 'connecting' | 'running' | 'error'
/** webcam: index on the server; stream: RTSP/RTMP/HTTP live feed; video: recorded video played in a loop */
export type CameraKind = 'webcam' | 'stream' | 'video'

export interface Camera {
  id: number
  name: string
  kind: CameraKind
  source: string
  uploaded: boolean
  location: string | null
  is_active: boolean
  status: CameraStatus
  last_error: string | null
  created_at: string
}

export interface LiveCow {
  track_id: number | null
  behaviour: Behaviour
  posture: string | null
  state: string | null
  confidence: number
}

export interface LiveSession {
  analysis_id: number | null
  started_at: string
  detections: number
  cows_tracked: number
  behaviour_counts: Partial<Record<Behaviour, number>>
}

/** Live state of a camera: from GET /cameras/{id}/live and every status message on its WebSocket. */
export interface LiveStatus {
  type: 'status'
  status: CameraStatus
  last_error: string | null
  active: boolean
  frame_at: string | null
  in_view: LiveCow[]
  session: LiveSession | null
  stream_fps: number
  detect_fps: number
}

export interface CameraLive {
  camera: Camera
  live: LiveStatus
}

export interface CameraInput {
  name: string
  kind: CameraKind
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
  analyses_total: number
  members_total: number
  behaviour_counts: Record<Behaviour, number>
  last_seen: Record<Behaviour, string | null>
  behaviour_over_time: { time: string; counts: Record<Behaviour, number> }[]
  recent_alerts: Alert[]
}

export interface Health {
  status: 'ok' | 'degraded'
  version: string
  model_loaded: boolean
  model_mode: 'single' | 'dual'
  model_error: string | null
  database_ok: boolean
  database_error: string | null
  cameras_running: number
  videos_waiting: number
  disk_free_mb: number | null
}
