import { API_BASE, api, query } from './client'
import type {
  Alert,
  AlertRule,
  Analysis,
  AnalysisDetail,
  Animal,
  AnimalInput,
  Behaviour,
  Camera,
  CameraInput,
  CameraLive,
  DashboardSummary,
  DetectionPage,
  Health,
  Invite,
  InvitePublic,
  Me,
  Member,
  Role,
  RuleType,
  Workspace,
} from './types'

export const authApi = {
  me: () => api<Me>('/auth/me'),
  login: (email: string, password: string) => api<Me>('/auth/login', { method: 'POST', body: { email, password } }),
  signup: (name: string, email: string, password: string) =>
    api<Me>('/auth/signup', { method: 'POST', body: { name, email, password } }),
  logout: () => api<void>('/auth/logout', { method: 'POST' }),
  updateProfile: (name: string) => api<Me>('/auth/me', { method: 'PATCH', body: { name } }),
  changePassword: (current_password: string, new_password: string) =>
    api<void>('/auth/change-password', { method: 'POST', body: { current_password, new_password } }),
}

export const healthApi = {
  get: () => api<Health>('/health'),
}

export const workspaceApi = {
  create: (name: string) => api<Workspace>('/workspaces', { method: 'POST', body: { name } }),
  rename: (id: number, name: string) => api<Workspace>(`/workspaces/${id}`, { method: 'PATCH', body: { name } }),
  members: (id: number) => api<Member[]>(`/workspaces/${id}/members`),
  setRole: (id: number, userId: number, role: Role) =>
    api<Member>(`/workspaces/${id}/members/${userId}`, { method: 'PATCH', body: { role } }),
  removeMember: (id: number, userId: number) =>
    api<void>(`/workspaces/${id}/members/${userId}`, { method: 'DELETE' }),
}

export const inviteApi = {
  list: (ws: number) => api<Invite[]>(`/workspaces/${ws}/invites`),
  create: (ws: number, email: string, role: Role) =>
    api<Invite>(`/workspaces/${ws}/invites`, { method: 'POST', body: { email, role } }),
  revoke: (id: number) => api<void>(`/invites/${id}`, { method: 'DELETE' }),
  getPublic: (token: string) => api<InvitePublic>(`/invites/${encodeURIComponent(token)}`),
  accept: (token: string) => api<Workspace>(`/invites/${encodeURIComponent(token)}/accept`, { method: 'POST' }),
}

function upload(file: File) {
  const form = new FormData()
  form.append('file', file)
  return form
}

export const analysisApi = {
  image: (ws: number, file: File) =>
    api<AnalysisDetail>(`/workspaces/${ws}/analyze/image`, { method: 'POST', form: upload(file) }),
  video: (ws: number, file: File) =>
    api<Analysis>(`/workspaces/${ws}/analyze/video`, { method: 'POST', form: upload(file) }),
  list: (ws: number, type?: 'image' | 'video' | 'camera', limit = 20) =>
    api<Analysis[]>(`/workspaces/${ws}/analyses${query({ type, limit })}`),
  get: (id: number) => api<AnalysisDetail>(`/analyses/${id}`),
  imageUrl: (id: number) => `${API_BASE}/analyses/${id}/image`,
}

export const cameraApi = {
  list: (ws: number) => api<Camera[]>(`/workspaces/${ws}/cameras`),
  create: (ws: number, body: CameraInput) => api<Camera>(`/workspaces/${ws}/cameras`, { method: 'POST', body }),
  /** A camera that plays an uploaded video in a loop. */
  createFromVideo: (ws: number, name: string, location: string | null, file: File) => {
    const form = upload(file)
    form.append('name', name)
    if (location) form.append('location', location)
    return api<Camera>(`/workspaces/${ws}/cameras/video`, { method: 'POST', form })
  },
  replaceVideo: (id: number, file: File) => api<Camera>(`/cameras/${id}/video`, { method: 'PUT', form: upload(file) }),
  update: (id: number, body: Partial<CameraInput>) => api<Camera>(`/cameras/${id}`, { method: 'PATCH', body }),
  remove: (id: number) => api<void>(`/cameras/${id}`, { method: 'DELETE' }),
  live: (id: number) => api<CameraLive>(`/cameras/${id}/live`),
  /** Newest frame with boxes drawn (404 until the camera has produced one). */
  frameUrl: (id: number) => `${API_BASE}/cameras/${id}/frame.jpg`,
  /** WebSocket with the live video (binary JPEG frames) and status (JSON text messages). */
  liveSocketUrl: (id: number) => `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}${API_BASE}/cameras/${id}/ws`,
  start: (id: number) => api<Camera>(`/cameras/${id}/start`, { method: 'POST' }),
  stop: (id: number) => api<Camera>(`/cameras/${id}/stop`, { method: 'POST' }),
}

export interface DetectionFilters {
  from?: string
  to?: string
  camera?: number
  behaviour?: Behaviour
  analysis?: number
  cow?: number
}

export const detectionApi = {
  list: (ws: number, f: DetectionFilters, limit: number, offset: number) =>
    api<DetectionPage>(`/workspaces/${ws}/detections${query({ ...f, limit, offset })}`),
  exportUrl: (ws: number, f: DetectionFilters) => `${API_BASE}/workspaces/${ws}/detections/export.csv${query({ ...f })}`,
}

export const dashboardApi = {
  summary: (ws: number) =>
    api<DashboardSummary>(`/workspaces/${ws}/dashboard/summary${query({ tz_offset: new Date().getTimezoneOffset() })}`),
}

export const alertApi = {
  list: (ws: number, status?: 'open' | 'acknowledged') => api<Alert[]>(`/workspaces/${ws}/alerts${query({ status })}`),
  acknowledge: (id: number) => api<Alert>(`/alerts/${id}/acknowledge`, { method: 'POST' }),
  rules: (ws: number) => api<AlertRule[]>(`/workspaces/${ws}/alert-rules`),
  createRule: (
    ws: number,
    body: { rule_type: RuleType; threshold: number | null; window_minutes: number; is_enabled: boolean },
  ) => api<AlertRule>(`/workspaces/${ws}/alert-rules`, { method: 'POST', body }),
  updateRule: (id: number, body: Partial<Pick<AlertRule, 'threshold' | 'window_minutes' | 'is_enabled'>>) =>
    api<AlertRule>(`/alert-rules/${id}`, { method: 'PATCH', body }),
  deleteRule: (id: number) => api<void>(`/alert-rules/${id}`, { method: 'DELETE' }),
}

export const animalApi = {
  list: (ws: number) => api<Animal[]>(`/workspaces/${ws}/animals`),
  create: (ws: number, body: AnimalInput) => api<Animal>(`/workspaces/${ws}/animals`, { method: 'POST', body }),
  update: (id: number, body: AnimalInput) => api<Animal>(`/animals/${id}`, { method: 'PUT', body }),
  remove: (id: number) => api<void>(`/animals/${id}`, { method: 'DELETE' }),
}
