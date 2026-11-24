# Farm Animal Activity Recognition using YOLO11

Final Year Project — BSCS, Department of Computer Science, Lahore Garrison University
Team: Fahad Moin, Faris Ali · Supervisor: Ahsan Raza

A web system that detects cows in farm camera images and videos and recognises four behaviours: **standing, lying, foraging, drinking**. Farm teams work inside shared workspaces, see activity on a dashboard, and get alerts when herd behaviour looks abnormal.

---

## 1. How it works

```
Image / Video / Camera  →  YOLO11 detection  →  Cow tracking (IDs)  →  Behaviour per cow  →  SQLite logs  →  Dashboard + Alerts
                                                        └──────────→  Live view (WebSocket video with boxes)
```

- **Model:** YOLO11s (Ultralytics), 4 classes, confidence threshold 0.45. One 4-class model, or a posture + state model pair.
- **Backend:** FastAPI + SQLite3 (SQLAlchemy ORM), background workers for videos and cameras.
- **Frontend:** React (Vite) + TypeScript + Tailwind CSS.

**System at a glance**

| Area | What it does | Details |
|---|---|---|
| Detection | Finds every cow and labels it standing, lying, foraging or drinking | §2 |
| Tracking | Gives each cow a number (`#1`, `#2`, …) that stays the same across frames, with label smoothing | §2 |
| Analyze | Image upload → instant annotated result; video upload → background job with progress and a per-cow table | §3, §4 |
| Cameras | Webcam, CCTV/IP stream or looping recorded video, shown as cards with a live snapshot; click a card to watch live | §3, §4 |
| Live view | Smooth video (up to 30 fps) with numbered boxes, cows in view, session totals | §4, §8 |
| Dashboard | Today's herd numbers, behaviour split, herd signals, 24-hour chart, recent alerts, camera status | §4 |
| Activity logs | Every detection, filterable, with cow IDs and CSV export | §4 |
| Alerts | Herd-level rules (lying ratio, no foraging, no drinking) checked every minute with noise guards | §3 |
| Workspaces | Teams with admin / member roles, invite links, setup checklist | §3, §4 |
| Animals | Manual cow register | §3 |
| Reliability | Health endpoint, setup doctor, logs with request IDs, auto-retry and reconnect | §8 |

---

## 2. Model

**Datasets:** CBVD-5 (Kaggle, `fandaoerji/cbvd-5cow-behavior-video-dataset`; AVA-format labels, 3,199 annotated keyframes, 25,324 cow boxes) and a second barn (Beef Cattle dataset). Test sets are split **by video** to avoid leakage.

**Final model:** YOLO11s, 4 classes (standing, lying, foraging, drinking), confidence threshold **0.45**.

**Why 4 classes:** the client rejected the old 5-class model (mAP50 0.635). Rumination was removed because it conflicted with lying: the same cow had two labels. Rumination is future work.

**Results** (mAP50, test set, split by video):

| Test set | Final model (4 classes) | Old model (5 classes) |
|---|---|---|
| CBVD-5 | **0.762** | 0.635 |
| Second barn (Beef Cattle dataset) | **0.918** | n/a |
| Both datasets combined | **0.769** | n/a |

Per class (CBVD-5 test set):

| Class | Final model mAP50 | Old model mAP50 |
|---|---|---|
| standing | TODO: not supplied yet | 0.672 |
| lying | **0.875** | 0.474 |
| foraging | TODO: not supplied yet | 0.855 |
| drinking | TODO: not supplied yet | 0.605 |
| rumination | removed (future work) | 0.566 |

**Why YOLO11s:** it was compared with YOLO11m and YOLOv8s. YOLO11s gave the fewest false boxes (0.58 per image) and is the smallest and fastest.

**Known limits:**
- Drinking is the weakest class: the test set has only 71 drinking cows.
- On a laptop CPU the model runs at about **2.9 FPS**.
- Tracking IDs last one session only. They cannot follow a named cow across days.

**Old model files:** a 5-class `best.pt` still loads. The backend logs a warning that rumination is no longer supported and ignores its rumination boxes. Old database rows with `rumination` are hidden from charts and shown as "Rumination (old data)" in lists.

**Dual mode (optional):** two models instead of one, because a cow has a posture *and* a state at the same time (e.g. standing + eating).

- `best_posture.pt` → standing, lying
- `best_state.pt` → foraging, drinking

The backend supports both modes through config:

```
MODEL_MODE=single   # uses models/best.pt (4 classes)
MODEL_MODE=dual     # uses models/best_posture.pt + models/best_state.pt, merged by IoU ≥ 0.5
```

In dual mode each detected cow gets `posture` + optional `state`.

Both modes write the same three columns, so dashboards and alerts don't care which mode is used:

| Column | Value |
|---|---|
| `posture` | `standing` / `lying` / empty |
| `state` | `foraging` / `drinking` / empty |
| `behaviour` | `state` if present, otherwise `posture` |

In single mode the model picks one label per cow (state wins), so a standing cow that is eating is stored as `posture` empty, `state = foraging`. The lying-ratio alert therefore uses only cows with a posture (lying / (standing + lying)). A state box that overlaps no posture box in dual mode is kept with an empty `posture`.

**Cow tracking (no extra model):** in videos and camera streams every cow gets an ID (`#1`, `#2`, …) that stays the same from frame to frame (`services/tracker.py`). Boxes are matched to existing tracks in two passes, both solved with the Hungarian algorithm: box overlap (IoU ≥ `TRACK_IOU`), then box-centre distance for cows whose box changed shape (e.g. standing up). A track survives `TRACK_MAX_LOST` missed frames. Each cow's label is the majority over its last `SMOOTH_WINDOW` frames, so one wrong frame doesn't flip it. A cow counts in summaries once it was tracked in 3 frames (shorter tracks are flickering boxes). IDs are numbered per video / camera session and are not identities: a cow that leaves the view and returns gets a new ID. In images, cows are numbered left to right.

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
- Upload a video → processed in the background (sample 1 frame/second), progress shown, results saved as activity logs. Each cow is tracked with an ID; the result shows a per-cow table (when it was in view, main behaviour, time split per behaviour).
- Camera → background worker samples frames, tracks cows and logs detections. A new camera is stopped; opening its live view starts monitoring, and it runs until someone presses Stop. Three camera types:
  - **Webcam** on the server, by number (`0`, `1`, …);
  - **Network stream**: RTSP / RTMP / HTTP(S) URL of a CCTV or IP camera;
  - **Recorded video**: a direct link to a video file, or an uploaded file. It plays at real-time speed and starts over at the end, so it behaves like a live camera (dashboard, alerts, activity log). Handy for demos without a camera. YouTube and other video *pages* are rejected with a hint, since they aren't video files.
- Errors (camera unreachable, stream lost, busy database) are shown on the camera and retried every 5 s; sessions cut off by a server restart are closed on the next start. See section 8.

**Alerts (rule-based, per camera)**
- Admin sets rules per workspace, for example:
  - Lying ratio above X% for more than Y minutes.
  - No foraging detected for more than Z hours.
  - No drinking detected for more than Z hours.
- Alerts show on the dashboard and alerts page; members can acknowledge them.
- Note: rules are herd-level (per camera). Cow IDs are used for per-cow summaries, not yet for alerts.
- Rules are checked every 60 s per running camera, with guards against noise:
  - a rule only runs once the camera has been monitored for the whole window;
  - the window needs at least 30 cow detections (cows actually in view);
  - "no foraging / drinking" counts the behaviour as seen only after 3 detections with confidence ≥ 0.5;
  - no new alert while one is open for the same rule + camera, or one was raised within the window.
- New workspaces get three default rules: lying ≥ 70 % over 1 h, no foraging for 6 h, no drinking for 12 h.

**Animals**
- Simple CRUD register (tag ID, name, breed, age, notes). Manual records only — tracking IDs are per session, so cows are not identified from video in this version.

---

## 4. Pages

| Page | Content |
|---|---|
| Landing `/` | Short hero, 3 feature blocks, how-it-works steps, sign up / log in buttons |
| Sign up / Log in | Simple centred form, clear error messages |
| Accept invite `/invite/:token` | Workspace name, role, join button |
| Dashboard | Greeting and quick actions; stat cards (cows detected today, active alerts, cameras online, analyses run); today's herd activity (share bar + table per behaviour); herd signals (lying and eating share, when drinking / eating was last seen); stacked activity chart for the last 24 completed hours; recent alerts and camera status lists. Herd numbers come from **camera monitoring only**: uploaded images and videos have no real capture time, so they are shown on the Analyze page instead. "Cows detected today" = the most cows seen together in one frame today (track IDs restart when a cow leaves the view, so IDs can't be counted as cows). |
| Analyze | Upload image/video, result preview with numbered boxes (`#3 lying 0.82`), per-cow table for videos (in view from–to, main behaviour, time split bar, link to that cow's detections), detections table with cow IDs. Video times are shown as the position in the video (e.g. `1:24`); the first 20 detections are listed, the rest are in Activity logs |
| Cameras | Grid of camera cards (1–4 per row by screen width). Each card shows a live snapshot with the cow boxes (refreshed once a second, `LIVE` tag) while the camera runs, otherwise a placeholder saying it is off, connecting or in error (with the reason); below it the name, location (or type) and status. Cards have no buttons: **click a card to open its live view.** "Add camera" (admin): webcam number, stream URL, video link or video upload. |
| Live view `/cameras/:id` | Cameras are **stopped by default**; opening a stopped camera starts monitoring automatically (once per visit, so a later Stop is kept). Smooth live video (the camera's own frame rate, up to 30 fps) with every cow boxed, numbered and labelled; boxes refresh several times a second; cows in view with confidence; totals since Start (cows tracked, detections, behaviour split); actual video and model rates; start/stop monitoring; edit and delete (admin). Leaving the page keeps the camera monitoring so alerts and the activity log keep working. Opened from a camera card or the dashboard camera list |
| Activity logs | Filterable table (date, camera, behaviour; analysis and cow via links), cow ID column, CSV export |
| Alerts | Open / acknowledged tabs, rule settings (admin) |
| Animals | Register table with add/edit/delete |
| Workspace settings | "Get your workspace ready" checklist while setup is incomplete (first analysis, first camera, invite team; can be hidden); workspace name and invite form side by side; members list and roles; pending invites |
| Profile | Name and password change, side by side on wide screens |

App layout: fixed left sidebar (nav + workspace switcher), top bar (page title, user menu), content area that uses the full width of the screen.

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

- **Behaviour colours** (charts and box labels): standing `#D9844F`, lying `#D4D4D4`, foraging `#F5B48A`, drinking `#FFDAC0`. All tokens live in `frontend/src/styles/tokens.css`.
- **Buttons:** solid primary, outlined secondary, 6px radius, 36–40px height, no icons inside unless needed.
- **Cards:** white, 1px border, 8px radius, very light shadow or none.
- **Layout:** 8px spacing scale, left-aligned headings. Content fills the full width beside the sidebar (no centred max-width column), and wide screens use multi-column grids instead of leaving empty side space.
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
cameras            id, workspace_id, name, kind (webcam|stream|video), source (webcam number, stream URL,
                   video URL, or the uploaded video's name), file_path (uploaded video), location,
                   is_active (monitoring on; resumed at startup), created_at
animals            id, workspace_id, tag_id, name, breed, age_months, notes, created_at   UNIQUE(workspace_id, tag_id)
analyses           id, workspace_id, user_id, camera_id (nullable), type (image|video|camera), original_name,
                   file_path, result_path (annotated image), status (queued|processing|done|failed),
                   progress, error, detection_count, created_at, finished_at
detections         id, workspace_id, analysis_id, camera_id (nullable), frame_index, frame_time, track_id, posture,
                   state, behaviour, confidence, x1, y1, x2, y2 (normalised 0-1), created_at
                   INDEX(workspace_id, frame_time), INDEX(camera_id, frame_time), INDEX(analysis_id, frame_index)
alert_rules        id, workspace_id, rule_type (lying_ratio|no_foraging|no_drinking), threshold (%),
                   window_minutes, is_enabled, created_at
alerts             id, workspace_id, camera_id, rule_id, message, severity (warning|danger),
                   status (open|acknowledged), acknowledged_by, acknowledged_at, created_at
```

Every query is filtered by `workspace_id` and checked against the user's membership. Routes that take a resource id without a workspace in the path (`/analyses/{id}`, `/cameras/{id}`, …) load the row and check membership of *its* workspace. Non-members get `404`, members on admin-only routes get `403`.

Tables are created on startup (`create_all`). New nullable columns (e.g. `detections.track_id`) are added to an existing `farm.db` automatically; for any other model change there are no migrations yet, so delete `farm.db`. SQLite runs in WAL mode so workers can write while the API reads. A camera stores about 1 row per cow per second (~700k rows/day for 8 cows), so plan retention or aggregation before long deployments.

---

## 7. API (FastAPI, prefix `/api`)

```
Health      GET /health                         (status ok|degraded, model, database, cameras running,
                                                 videos waiting, free disk, version, uptime)
Auth        POST /auth/signup · POST /auth/login · POST /auth/logout · GET /auth/me
            PATCH /auth/me (name) · POST /auth/change-password
Workspaces  GET /workspaces · POST /workspaces · GET /workspaces/{id} · PATCH /workspaces/{id}
Members     GET /workspaces/{id}/members · PATCH /workspaces/{id}/members/{uid} · DELETE …/{uid}
Invites     POST /workspaces/{id}/invites · GET /workspaces/{id}/invites · DELETE /invites/{id}
            GET /invites/{token} · POST /invites/{token}/accept
Analysis    POST /workspaces/{id}/analyze/image · POST /workspaces/{id}/analyze/video
            GET /workspaces/{id}/analyses?type&limit · GET /analyses/{id} · GET /analyses/{id}/image
Cameras     GET|POST /workspaces/{id}/cameras  (json: name, kind, source, location)
            POST /workspaces/{id}/cameras/video (form: name, location, file) · PUT /cameras/{id}/video (file)
            GET|PATCH|DELETE /cameras/{id} · POST /cameras/{id}/start · POST /cameras/{id}/stop
            GET /cameras/{id}/live (camera + live status: cows in view, session totals, rates; from memory)
            GET /cameras/{id}/frame.jpg (snapshot of the newest frame with boxes; 404 until there is one.
                                         The camera cards poll it once a second)
            WS  /cameras/{id}/ws (live view: binary = JPEG frames, text = live status JSON twice a second;
                                  close 4401 not logged in, 4404 no access)
Activity    GET /workspaces/{id}/detections?from&to&camera&behaviour&analysis&cow&limit&offset
            GET /workspaces/{id}/detections/export.csv (same filters)
Dashboard   GET /workspaces/{id}/dashboard/summary?tz_offset
Alerts      GET /workspaces/{id}/alerts?status · POST /alerts/{id}/acknowledge
            GET|POST /workspaces/{id}/alert-rules · PATCH|DELETE /alert-rules/{id}
Animals     GET|POST /workspaces/{id}/animals · GET|PUT|DELETE /animals/{id}
```

Admin-only routes return `403` for members. Validation with Pydantic; errors return `{ "detail": "message" }` (validation errors too, e.g. `"email: Enter a valid email address"`). Every response has an `X-Request-ID` header; `500` errors include it as `(ref …)`. Interactive docs: http://127.0.0.1:8000/docs.

Invite rules: only the invited email can accept the link; creating a new invite for the same email revokes the old one; a workspace always keeps at least one admin. Camera stream credentials (`rtsp://user:pass@…`) are shown masked to members.

---

## 8. Reliability and troubleshooting

How each failure is handled, so the app keeps running and problems can be found quickly:

| What goes wrong | What happens |
|---|---|
| Model file missing or broken | API still starts; `/api/health` and a banner on Analyze/Cameras show the reason; uploads return `503` |
| Bad value in `backend/.env` | Startup stops with a message naming the setting (e.g. `CONF_THRESHOLD: Input should be less than 1`) |
| Camera can't be opened / stream drops / video link down | Camera shows **Error** with the reason and retries every 5 s; it never stops on its own |
| Database busy (heavy camera writes) | Camera workers retry; API requests get `503 The database is busy` with `Retry-After` |
| Unreadable upload (wrong format, broken file) | Rejected immediately with `400` and a hint; nothing is stored |
| Disk full / folder not writable | `507` with a clear message; partial files are removed |
| Unexpected bug in a request | `500` with a reference, e.g. `(ref 3f9c2a1b7d)`; the full traceback is in `backend/logs/app.log` under that reference |
| Server stopped mid-video | Shutdown is immediate; the video is re-queued from the start on the next run |
| Server stopped while cameras run | Their sessions are closed on the next start and monitoring resumes for cameras left on |
| Backend not running | The UI says "Cannot reach the backend server" instead of a generic error |
| Model slower than the video (weak CPU) | The video stays smooth; only the boxes refresh less often (the rate is shown under the video) |
| Viewer on a slow network | Frames are skipped, never queued, so the picture never falls behind |
| Live connection drops (Wi-Fi, server restart) | The live page says so and reconnects by itself |
| A page crashes in the browser | A recovery screen with "Reload page" instead of a blank page |

**When something doesn't work:**
1. `python backend/doctor.py`: checks Python, packages, `.env`, folders, database, model (loads it and runs one detection), OpenCV video support, Node.js and ports, and prints the fix for each problem. `run.bat` / `run.sh` run it (`--quick --ports`) before starting the servers.
2. `backend/logs/app.log` (rotated at 5 MB): every warning and error with time, thread (`camera-3`, `video_0`, …) and request reference. Set `LOG_LEVEL=DEBUG` in `.env` for more detail.
3. http://127.0.0.1:8000/api/health: model, database, running cameras, videos waiting, free disk space.

---

**Live camera pipeline** (per camera, `services/camera_worker.py`):

```
camera / stream / video --> reader thread (full frame rate) --> newest frame only
                                 |                                   |
                                 | while someone watches:            v
                                 | draw latest boxes, JPEG,     analysis loop: model + tracker on the
                                 | up to STREAM_FPS                  newest frame, up to LIVE_DETECT_FPS
                                 v                                   while watched (else 1/s);
                          WebSocket --> browser canvas               1 row per cow per second to the
                                                                     database; alert rules every minute
```

The reader never waits for the model, so the video is smooth on any machine; a slow model only refreshes the boxes less often. Frames are encoded only while someone watches.

---

## 9. Project structure

```
Farm Animal Activity Recognition/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app, lifespan (model load, worker resume), error handlers, health
│   │   ├── config.py          # settings from .env, validated at startup (paths relative to backend/)
│   │   ├── logging_setup.py   # console + rotating backend/logs/app.log
│   │   ├── database.py        # SQLite engine (WAL) + session
│   │   ├── models.py          # SQLAlchemy models
│   │   ├── schemas.py         # Pydantic schemas
│   │   ├── auth.py            # bcrypt, JWT cookie, current user, workspace/role checks
│   │   ├── routers/           # auth, workspaces, invites, analysis, cameras, detections, alerts, animals, dashboard
│   │   └── services/
│   │       ├── detector.py    # loads YOLO model(s) once, thread-safe inference, posture + state merge
│   │       ├── tracker.py     # cow IDs across frames (IoU + Hungarian), label smoothing
│   │       ├── storage.py     # upload saving (type/size/disk checks), detection rows
│   │       ├── sources.py     # camera frame sources: webcam, stream, looping video; source validation
│   │       ├── video_worker.py   # background video queue (graceful stop, resumes unfinished jobs)
│   │       ├── camera_worker.py  # one thread per active camera, retries on errors, runs alert checks
│   │       └── alert_engine.py   # herd-level rules
│   ├── tests/                 # pytest: auth, isolation, invites, analysis, alerts, tracking, cameras, errors
│   ├── doctor.py              # setup check with fixes (run.bat / run.sh call it)
│   ├── seed_demo.py           # demo workspace with 24 h of activity
│   ├── models/                # best.pt  or  best_posture.pt + best_state.pt
│   ├── uploads/               # created at runtime (camera videos in uploads/<workspace>/cameras/)
│   ├── logs/                  # app.log, created at runtime
│   ├── requirements.txt · requirements-dev.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/               # fetch client, types, endpoint functions
│   │   ├── components/
│   │   │   ├── ui/            # Button, Field, Card, Table, Modal, Badge, StatCard, Tabs, States
│   │   │   ├── layout/        # AppLayout, Sidebar, UserMenu, Guards, Logo
│   │   │   ├── SetupChecklist.tsx  # "Get your workspace ready" (Workspace settings)
│   │   │   ├── ModelStatus.tsx     # model problem banner (Analyze, Cameras)
│   │   │   └── ErrorBoundary.tsx   # recovery screen when a page crashes
│   │   ├── context/           # auth + workspace contexts
│   │   ├── hooks/             # useAsync, useInterval, useLiveStream (live view WebSocket)
│   │   ├── lib/               # behaviour colours/labels, camera labels, formatting, nav, storage
│   │   ├── pages/             # one file per page
│   │   └── styles/tokens.css  # design tokens (Tailwind v4 @theme)
│   ├── vite.config.ts         # dev proxy /api (HTTP + WebSocket) -> 127.0.0.1:8000 (or API_TARGET)
│   └── package.json
├── Notebook/
│   ├── Notebook.ipynb         # CBVD-5 -> YOLO conversion + YOLO11s training (Kaggle)
│   └── model/best.pt          # trained weights (final model: 4 classes)
└── README.md
```

---

## 10. Setup

Requires Python 3.10+ and Node.js 20.19+ or 22.12+ (22 LTS recommended).

**Quick start (one command)**: installs packages straight into your Python with pip (no venv), creates `backend/.env` with a random secret, copies `Notebook/model/best.pt` to `backend/models/`, runs `npm install`, checks the setup with `doctor.py`, then starts both servers:

```
run.bat        # Windows: double-click, or run from cmd. Opens a Backend and a Frontend window.
./run.sh       # Git Bash / Linux / macOS. Ctrl+C stops both.
```

Then open http://localhost:5173. Ports 8000 and 5173 must be free (the setup check tells you if they aren't). The quick start runs the backend without auto-reload, which is more stable for demos; use the manual command below while developing.

**Demo data (for presentations):** `cd backend && python seed_demo.py` creates the account **demo@farm.local / demo12345** with a "Green Valley Dairy" workspace: 3 cameras, 8 animals, 2 open alerts and 24 hours of realistic herd activity (feeding in the morning and evening, resting at night). Run it again at any time to refresh the last 24 hours.

Manual steps, if you prefer:

**Backend**
```bash
cd backend
python -m venv venv && source venv/bin/activate      # Windows: venv\Scripts\activate
# CPU-only machine? Install the small CPU build of PyTorch first:
#   pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt   # fastapi uvicorn sqlalchemy pydantic-settings bcrypt PyJWT python-multipart ultralytics opencv-python numpy scipy (Hungarian matching)
cp .env.example .env              # then set JWT_SECRET (the server refuses to start with "change-me"):
python -c "import secrets; print(secrets.token_urlsafe(48))"
cp ../Notebook/model/best.pt models/best.pt
uvicorn app.main:app --reload     # http://127.0.0.1:8000  (API docs at /docs)
```

`.env` (full list in `.env.example`)
```
DATABASE_URL=sqlite:///./farm.db
JWT_SECRET=<long random string>
JWT_EXPIRE_HOURS=24
COOKIE_SECURE=false            # true when served over HTTPS
MODEL_MODE=single
MODEL_PATH=models/best.pt
POSTURE_MODEL_PATH=models/best_posture.pt
STATE_MODEL_PATH=models/best_state.pt
CONF_THRESHOLD=0.45
MERGE_IOU=0.5                  # dual mode: posture/state boxes of the same cow
INFERENCE_IMGSZ=640
TRACK_IOU=0.3
TRACK_MAX_LOST=5
SMOOTH_WINDOW=5                # 1 = no label smoothing
UPLOAD_DIR=uploads
MAX_UPLOAD_MB=200
VIDEO_SAMPLE_FPS=1
CAMERA_SAMPLE_SECONDS=1
ALERT_CHECK_SECONDS=60
STREAM_FPS=30
LIVE_DETECT_FPS=8
STREAM_MAX_WIDTH=960
STREAM_JPEG_QUALITY=75
FRONTEND_URL=http://localhost:5173
LOG_LEVEL=INFO
LOG_DIR=logs
```

Every value is checked at startup; a wrong one stops the server with a message naming it. If the model file is missing the API still starts; `/api/health` and the Analyze/Cameras pages show the error.

**Frontend**
```bash
cd frontend
npm install        # react-router-dom recharts lucide-react @fontsource-variable/inter tailwindcss
npm run dev        # http://localhost:5173 — /api is proxied to the backend, so the auth cookie is same-origin
```

**Docker (optional)**
```bash
cp Notebook/model/best.pt backend/models/best.pt     # or put the final model there yourself
echo "JWT_SECRET=$(python -c 'import secrets; print(secrets.token_urlsafe(48))')" > .env
docker compose up --build                            # then open http://localhost:8080
```
nginx serves the frontend and forwards `/api` (including the live-view WebSocket) to the backend, so both share one origin. Data is kept in the `farm-data` volume. For HTTPS, add `COOKIE_SECURE=true` and `FRONTEND_URL=https://your-domain` to `.env`.

**Tests and checks**
```bash
cd backend && pip install -r requirements-dev.txt && pytest -q   # temp DB; no model file needed (a few real-model tests are skipped without models/best.pt)
cd frontend && npx tsc -b && npm run lint && npm run build
```

**Security**

- `JWT_SECRET` is never committed. `.env.example` only has the placeholder `change-me`, and the server refuses to start with it. `run.sh` / `run.bat` create `backend/.env` with a random secret.
- **HTTPS:** set `COOKIE_SECURE=true` in `backend/.env` whenever the site is served over HTTPS, so the login cookie is only sent over encrypted connections. Keep it `false` for local `http://` development, or login will not work.
- Auth uses an httpOnly, `SameSite=Lax` cookie. In production, serve the built frontend and the API from the same origin over HTTPS.
- The camera live-view WebSocket only accepts pages from `FRONTEND_URL` (other origins are closed with code 4403). Set `FRONTEND_URL` to the address people open in the browser.
- Login is rate limited: after 10 failed attempts in 10 minutes for the same IP address and email, the API returns 429 until the window passes.

---

## 11. Build rules (for developers and AI coding tools)

1. Follow this README as the spec. Do not add features not listed here.
2. Keep the design rules in section 5 strictly — flat colours, Inter font, no gradients or decorative elements.
3. Load the YOLO model once at startup, not per request.
4. Run video and camera processing in background workers; never block an API request.
5. Every workspace route checks membership and role.
6. Store uploads on disk, store paths in the database.
7. Show loading, empty and error states on every page.

---

## 12. Out of scope (this version)

Identifying the same cow across sessions or days (re-identification), per-cow alert rules, SMS alerts, native mobile apps, multi-farm hardware setup.