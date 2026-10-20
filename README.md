# Farm Animal Activity Recognition using YOLO11

Final Year Project — BSCS, Department of Computer Science, Lahore Garrison University
Team: Fahad Moin, Faris Ali · Supervisor: Ahsan Raza

A web system that detects cows in farm camera images and videos and recognises five behaviours: **standing, lying, foraging, drinking, rumination**. Farm teams work inside shared workspaces, see activity on a dashboard, and get alerts when herd behaviour looks abnormal.

---

## 1. How it works

```
Image / Video / Camera  →  YOLO11 detection  →  Behaviour per cow  →  SQLite logs  →  Dashboard + Alerts
```

- **Model:** YOLO11 (Ultralytics), fine-tuned on the CBVD-5 dataset.
- **Backend:** FastAPI + SQLite3 (SQLAlchemy ORM).
- **Frontend:** React (Vite) + TypeScript.

---

## 2. Model

**Dataset:** CBVD-5 (Kaggle, `fandaoerji/cbvd-5cow-behavior-video-dataset`). AVA-format labels, 3,199 annotated keyframes, 25,324 cow boxes. Split **by video** (70/15/15) to avoid leakage.

**Baseline results** (YOLO11s, 640px, test set):

| Class | mAP50 | mAP50-95 | F1 |
|---|---|---|---|
| standing | 0.672 | 0.313 | 0.691 |
| lying | 0.474 | 0.215 | 0.476 |
| foraging | 0.855 | 0.564 | 0.833 |
| drinking | 0.605 | 0.277 | 0.585 |
| rumination | 0.566 | 0.300 | 0.601 |
| **all** | **0.635** | **0.334** | **0.641** |

**Improved approach (in progress):** two models instead of one, because a cow has a posture *and* a state at the same time (e.g. lying + ruminating).

- `best_posture.pt` → standing, lying
- `best_state.pt` → foraging, drinking, rumination

The backend must support both modes through config:

```
MODEL_MODE=single   # uses models/best.pt (5 classes)
MODEL_MODE=dual     # uses models/best_posture.pt + models/best_state.pt, merged by IoU ≥ 0.5
```

In dual mode each detected cow gets `posture` + optional `state`.

Both modes write the same three columns, so dashboards and alerts don't care which mode is used:

| Column | Value |
|---|---|
| `posture` | `standing` / `lying` / empty |
| `state` | `foraging` / `drinking` / `rumination` / empty |
| `behaviour` | `state` if present, otherwise `posture` |

In single mode the 5-class model picks one label per cow (state wins), so a lying cow that is ruminating is stored as `posture` empty, `state = rumination`. Lying ratios are therefore lower in single mode than in dual mode. A state box that overlaps no posture box in dual mode is kept with an empty `posture`.

**Known limit:** rumination is jaw movement over time, so single-frame accuracy is limited. A temporal model is future work.

---

## 3. Features

**Authentication**
- Sign up (name, email, password), log in, log out.
- Passwords hashed with bcrypt. JWT access token stored in an httpOnly cookie.
- Protected routes on both backend and frontend.

**Workspaces**
- A new user creates a workspace on first login and becomes its **admin**.
- A user can belong to several workspaces and switch between them.
- Roles:
  - **Admin:** manage members, invites, cameras, animals, alert rules, workspace settings.
  - **Member:** view dashboard, run analysis, view and acknowledge alerts.

**Member invites**
- Admin enters an email and role → system creates an invite link (`/invite/{token}`, expires in 7 days).
- Admin copies the link from the UI (email sending is optional, later).
- The invited person opens the link → signs up or logs in → joins the workspace.
- Admin can revoke pending invites, change roles, and remove members.

**Analysis**
- Upload an image → returns annotated image + list of detections.
- Upload a video → processed in the background (sample 1 frame/second), progress shown, results saved as activity logs.
- Camera (webcam or RTSP URL) → background worker samples frames and logs detections.

**Alerts (rule-based, per camera)**
- Admin sets rules per workspace, for example:
  - Lying ratio above X% for more than Y minutes.
  - No foraging detected for more than Z hours.
  - No drinking detected for more than Z hours.
- Alerts show on the dashboard and alerts page; members can acknowledge them.
- Note: rules are herd-level (per camera). Per-cow tracking is not part of this version.
- Rules are checked every 60 s per running camera, with guards against noise:
  - a rule only runs once the camera has been monitored for the whole window;
  - the window needs at least 30 cow detections (cows actually in view);
  - "no foraging / drinking" counts the behaviour as seen only after 3 detections with confidence ≥ 0.5;
  - no new alert while one is open for the same rule + camera, or one was raised within the window.
- New workspaces get three default rules: lying ≥ 70 % over 1 h, no foraging for 6 h, no drinking for 12 h.

**Animals**
- Simple CRUD register (tag ID, name, breed, age, notes). Manual records only — no per-cow identification from video in this version.

---

## 4. Pages

| Page | Content |
|---|---|
| Landing `/` | Short hero, 3 feature blocks, how-it-works steps, sign up / log in buttons |
| Sign up / Log in | Simple centred form, clear error messages |
| Accept invite `/invite/:token` | Workspace name, role, join button |
| Dashboard | Stat cards (cows detected today, active alerts, cameras online, analyses run), behaviour distribution bar chart, behaviour over time line chart, recent alerts table. "Cows detected today" = the most cows seen together in one frame today (without tracking, cows can't be counted uniquely). |
| Analyze | Upload image/video, result preview with boxes, detections table |
| Cameras | List, add/edit (admin), status, start/stop monitoring |
| Activity logs | Filterable table (date, camera, behaviour), CSV export |
| Alerts | Open / acknowledged tabs, rule settings (admin) |
| Animals | Register table with add/edit/delete |
| Workspace settings | Members list, roles, invite form, pending invites, workspace name |
| Profile | Name, password change |

App layout: fixed left sidebar (nav + workspace switcher), top bar (page title, user menu), content area.

---

## 5. Design rules

The UI must look like a clean, professional product — not an AI-generated template.

- **No** gradients, glassmorphism, glowing shadows, decorative dots/blobs, emoji, or sparkle icons.
- **Font:** `Inter` (fallback: `system-ui, sans-serif`). Base size 15px, line height 1.5.
  Headings 600 weight: 28 / 22 / 18px. Body 400.
- **Colours** (flat only):

| Use | Colour |
|---|---|
| Primary (buttons, links, active nav) | `#1F6F4A` (hover `#185C3D`) |
| Page background | `#F7F8F7` |
| Surface (cards, tables) | `#FFFFFF` |
| Border (cards, tables) | `#E3E6E4` |
| Input border | `#8A938E` (3:1 on white) |
| Text primary | `#1A1D1B` |
| Text secondary | `#5F6762` |
| Success | `#2E7D32` |
| Warning | `#9A5B00` |
| Danger | `#C62828` |

- **Behaviour colours** (charts and box labels): standing `#2E6FB0`, lying `#7A5AA6`, foraging `#2E7D32`, drinking `#0B7676`, rumination `#9A5B00`.
  Warning, drinking and rumination were darkened from `#B26A00` / `#0F8A8A` so they pass 4.5:1. All tokens live in `frontend/src/styles/tokens.css`.
- **Buttons:** solid primary, outlined secondary, 6px radius, 36–40px height, no icons inside unless needed.
- **Cards:** white, 1px border, 8px radius, very light shadow or none.
- **Layout:** 8px spacing scale, left-aligned headings, max content width 1200px, plenty of white space.
- **Responsive:** sidebar collapses to a menu on small screens.
- **Accessible:** visible focus states, contrast ≥ 4.5:1, labels on every input.
- Icons: `lucide-react`, outline style, 16–18px. Charts: `recharts`.

---

## 6. Database (SQLite)

```
users              id, name, email (unique), password_hash, created_at
workspaces         id, name, created_by → users.id, created_at
workspace_members  id, workspace_id, user_id, role (admin|member), joined_at   UNIQUE(workspace_id, user_id)
invites            id, workspace_id, email, role, token (unique), status (pending|accepted|revoked),
                   invited_by, expires_at, created_at
cameras            id, workspace_id, name, source (webcam index or RTSP URL), location,
                   is_active (monitoring on; resumed at startup), created_at
animals            id, workspace_id, tag_id, name, breed, age_months, notes, created_at   UNIQUE(workspace_id, tag_id)
analyses           id, workspace_id, user_id, camera_id (nullable), type (image|video|camera), original_name,
                   file_path, result_path (annotated image), status (queued|processing|done|failed),
                   progress, error, detection_count, created_at, finished_at
detections         id, workspace_id, analysis_id, camera_id (nullable), frame_index, frame_time, posture,
                   state, behaviour, confidence, x1, y1, x2, y2 (normalised 0-1), created_at
                   INDEX(workspace_id, frame_time), INDEX(camera_id, frame_time), INDEX(analysis_id, frame_index)
alert_rules        id, workspace_id, rule_type (lying_ratio|no_foraging|no_drinking), threshold (%),
                   window_minutes, is_enabled, created_at
alerts             id, workspace_id, camera_id, rule_id, message, severity (warning|danger),
                   status (open|acknowledged), acknowledged_by, acknowledged_at, created_at
```

Every query is filtered by `workspace_id` and checked against the user's membership. Routes that take a resource id without a workspace in the path (`/analyses/{id}`, `/cameras/{id}`, …) load the row and check membership of *its* workspace. Non-members get `404`, members on admin-only routes get `403`.

Tables are created on startup (`create_all`); there are no migrations yet, so delete `farm.db` after changing models. SQLite runs in WAL mode so workers can write while the API reads. A camera stores about 1 row per cow per second (~700k rows/day for 8 cows), so plan retention or aggregation before long deployments.

---

## 7. API (FastAPI, prefix `/api`)

```
Health      GET /health                         (model loaded? mode, load error)
Auth        POST /auth/signup · POST /auth/login · POST /auth/logout · GET /auth/me
            PATCH /auth/me (name) · POST /auth/change-password
Workspaces  GET /workspaces · POST /workspaces · GET /workspaces/{id} · PATCH /workspaces/{id}
Members     GET /workspaces/{id}/members · PATCH /workspaces/{id}/members/{uid} · DELETE …/{uid}
Invites     POST /workspaces/{id}/invites · GET /workspaces/{id}/invites · DELETE /invites/{id}
            GET /invites/{token} · POST /invites/{token}/accept
Analysis    POST /workspaces/{id}/analyze/image · POST /workspaces/{id}/analyze/video
            GET /workspaces/{id}/analyses?type&limit · GET /analyses/{id} · GET /analyses/{id}/image
Cameras     GET|POST /workspaces/{id}/cameras · GET|PATCH|DELETE /cameras/{id}
            POST /cameras/{id}/start · POST /cameras/{id}/stop
Activity    GET /workspaces/{id}/detections?from&to&camera&behaviour&analysis&limit&offset
            GET /workspaces/{id}/detections/export.csv (same filters)
Dashboard   GET /workspaces/{id}/dashboard/summary?tz_offset
Alerts      GET /workspaces/{id}/alerts?status · POST /alerts/{id}/acknowledge
            GET|POST /workspaces/{id}/alert-rules · PATCH|DELETE /alert-rules/{id}
Animals     GET|POST /workspaces/{id}/animals · GET|PUT|DELETE /animals/{id}
```

Admin-only routes return `403` for members. Validation with Pydantic; errors return `{ "detail": "message" }` (validation errors too, e.g. `"email: Enter a valid email address"`). Interactive docs: http://127.0.0.1:8000/docs.

Invite rules: only the invited email can accept the link; creating a new invite for the same email revokes the old one; a workspace always keeps at least one admin. Camera stream credentials (`rtsp://user:pass@…`) are shown masked to members.

---

## 8. Project structure

```
Farm Animal Activity Recognition/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app, lifespan (model load, worker resume), CORS, error format
│   │   ├── config.py          # settings from .env (paths resolved relative to backend/)
│   │   ├── database.py        # SQLite engine (WAL) + session
│   │   ├── models.py          # SQLAlchemy models
│   │   ├── schemas.py         # Pydantic schemas
│   │   ├── auth.py            # bcrypt, JWT cookie, current user, workspace/role checks
│   │   ├── routers/           # auth, workspaces, invites, analysis, cameras, detections, alerts, animals, dashboard
│   │   └── services/
│   │       ├── detector.py    # loads YOLO model(s) once, thread-safe inference, posture + state merge
│   │       ├── storage.py     # upload saving (type/size checks), detection rows
│   │       ├── video_worker.py   # background video queue (resumes unfinished jobs on restart)
│   │       ├── camera_worker.py  # one thread per active camera, reconnects, runs alert checks
│   │       └── alert_engine.py   # herd-level rules
│   ├── tests/                 # pytest: auth, isolation, invites, analysis, alerts
│   ├── models/                # best.pt  or  best_posture.pt + best_state.pt (not committed)
│   ├── uploads/               # created at runtime
│   ├── requirements.txt · requirements-dev.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/               # fetch client, types, endpoint functions
│   │   ├── components/
│   │   │   ├── ui/            # Button, Field, Card, Table, Modal, Badge, StatCard, Tabs, States
│   │   │   └── layout/        # AppLayout, Sidebar, UserMenu, Guards, Logo
│   │   ├── context/           # auth + workspace contexts
│   │   ├── hooks/             # useAsync, useInterval
│   │   ├── lib/               # behaviour colours/labels, formatting, nav
│   │   ├── pages/             # one file per page
│   │   └── styles/tokens.css  # design tokens (Tailwind v4 @theme)
│   ├── vite.config.ts         # dev proxy /api -> 127.0.0.1:8000
│   └── package.json
├── Notebook/
│   ├── Notebook.ipynb         # CBVD-5 -> YOLO conversion + YOLO11s training (Kaggle)
│   └── model/best.pt          # trained 5-class weights
└── README.md
```

---

## 9. Setup

Requires Python 3.10+ and Node 20+.

**Quick start (one command)** — installs packages straight into your Python with pip (no venv), creates `backend/.env` with a random secret, copies `Notebook/model/best.pt` to `backend/models/`, runs `npm install`, then starts both servers:

```
run.bat        # Windows: double-click, or run from cmd. Opens a Backend and a Frontend window.
./run.sh       # Git Bash / Linux / macOS. Ctrl+C stops both.
```

Then open http://localhost:5173. Ports 8000 and 5173 must be free.

Manual steps, if you prefer:

**Backend**
```bash
cd backend
python -m venv venv && source venv/bin/activate      # Windows: venv\Scripts\activate
# CPU-only machine? Install the small CPU build of PyTorch first:
#   pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt   # fastapi uvicorn sqlalchemy pydantic-settings bcrypt PyJWT python-multipart ultralytics opencv-python
cp .env.example .env              # then set JWT_SECRET (the server refuses to start with "change-me"):
python -c "import secrets; print(secrets.token_urlsafe(48))"
cp ../Notebook/model/best.pt models/best.pt
uvicorn app.main:app --reload     # http://127.0.0.1:8000  (API docs at /docs)
```

`.env` (full list in `.env.example`)
```
DATABASE_URL=sqlite:///./farm.db
JWT_SECRET=<long random string>
MODEL_MODE=single
MODEL_PATH=models/best.pt
POSTURE_MODEL_PATH=models/best_posture.pt
STATE_MODEL_PATH=models/best_state.pt
CONF_THRESHOLD=0.35
MAX_UPLOAD_MB=200
VIDEO_SAMPLE_FPS=1
CAMERA_SAMPLE_SECONDS=1
ALERT_CHECK_SECONDS=60
FRONTEND_URL=http://localhost:5173
```

If the model file is missing the API still starts; `/api/health` and the Analyze/Cameras pages show the error.

**Frontend**
```bash
cd frontend
npm install        # react-router-dom recharts lucide-react @fontsource-variable/inter tailwindcss
npm run dev        # http://localhost:5173 — /api is proxied to the backend, so the auth cookie is same-origin
```

**Tests and checks**
```bash
cd backend && pip install -r requirements-dev.txt && pytest      # uses a temp DB; inference tests need models/best.pt
cd frontend && npm run lint && npm run build
```

Auth uses an httpOnly, `SameSite=Lax` cookie. In production, serve the built frontend and the API from the same origin over HTTPS and set `COOKIE_SECURE=true`.

---

## 10. Build rules (for developers and AI coding tools)

1. Follow this README as the spec. Do not add features not listed here.
2. Keep the design rules in section 5 strictly — flat colours, Inter font, no gradients or decorative elements.
3. Load the YOLO model once at startup, not per request.
4. Run video and camera processing in background workers; never block an API request.
5. Every workspace route checks membership and role.
6. Store uploads on disk, store paths in the database.
7. Show loading, empty and error states on every page.

---

## 11. Out of scope (this version)

Per-cow tracking and identification, SMS alerts, native mobile apps, multi-farm hardware setup.