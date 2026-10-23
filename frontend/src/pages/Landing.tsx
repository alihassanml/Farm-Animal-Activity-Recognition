import { useState } from 'react'
import { Link } from 'react-router-dom'
import shotAlerts from '../assets/screens/alerts.jpg'
import shotAnalyze from '../assets/screens/analyze.jpg'
import shotDashboard from '../assets/screens/dashboard.jpg'
import shotMembers from '../assets/screens/members.jpg'
import { useAuth } from '../context/auth'

/* Landing page ("/"). Flat, calm layout: no icons, no dots, no gradients.
   Screenshots are real captures of the app (demo workspace) in src/assets/screens/. */

const NAV_LINKS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#behaviours', label: 'Behaviours' },
  { href: '#features', label: 'Features' },
]

const STEPS = [
  {
    n: '01',
    title: 'Add your cameras',
    text: 'Add a webcam or an IP camera with its RTSP link, or simply upload an image or a video.',
  },
  {
    n: '02',
    title: 'Detect behaviour',
    text: 'Each frame is checked by a YOLO11 model trained on real barn footage. Every cow gets a behaviour label.',
  },
  {
    n: '03',
    title: 'Act on alerts',
    text: 'See the day’s activity on the dashboard and get alerts when the herd lies too much or stops eating or drinking.',
  },
]

const BEHAVIOURS = [
  { name: 'Standing', color: '#2E6FB0', text: 'Upright on four legs. Shows activity and comfort.' },
  { name: 'Lying', color: '#7A5AA6', text: 'Resting on the ground. Too much lying can signal illness or lameness.' },
  { name: 'Foraging', color: '#2E7D32', text: 'Eating at the feed trough.' },
  { name: 'Drinking', color: '#0F8A8A', text: 'At the water point. Long gaps can mean heat stress or sickness.' },
  { name: 'Rumination', color: '#B26A00', text: 'Chewing the cud, a key sign of good digestion.' },
]

const FEATURES = [
  {
    title: 'A clear daily dashboard',
    text: 'Cows seen today, open alerts, cameras online, and a chart of behaviour over the last 24 hours.',
    shot: { src: shotDashboard, alt: 'Dashboard showing cows seen today, open alerts, cameras and herd activity' },
  },
  {
    title: 'Alerts you can trust',
    text: 'Rules run per camera and only trigger after enough data is collected, so one wrong detection does not raise an alarm. You can change the limits for your farm.',
    shot: { src: shotAlerts, alt: 'Alerts page with open alerts and the alert rules for each camera' },
  },
  {
    title: 'Built for teams',
    text: 'Create a workspace for your farm and invite staff or your vet with a link. Admins manage cameras and rules; members view and respond.',
    shot: { src: shotMembers, alt: 'Workspace settings with the member list and invite form' },
  },
]

// Shared building blocks (local to this page)
const CONTAINER = 'mx-auto w-full max-w-[1120px] px-4 sm:px-6'
const SECTION = 'py-16 md:py-24'
const H2 = 'text-[28px] leading-[1.25] font-semibold tracking-[-0.01em]'
const BTN = 'inline-flex h-11 items-center justify-center rounded-md px-5 text-base font-medium whitespace-nowrap transition-colors'
const BTN_PRIMARY = `${BTN} bg-primary text-white hover:bg-primary-hover`
const BTN_SECONDARY = `${BTN} border border-line-strong bg-surface text-ink hover:bg-page`

function Screenshot({ src, alt, width, height, eager }: { src: string; alt: string; width: number; height: number; eager?: boolean }) {
  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className="block h-auto w-full rounded-lg border border-line bg-page shadow-[0_1px_2px_rgb(16_24_20/0.04)]"
    />
  )
}

function Header() {
  const { me } = useAuth()
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <header className="border-b border-line bg-surface">
      <div className={`${CONTAINER} flex h-16 items-center justify-between gap-6`}>
        <Link to="/" className="text-lg font-semibold text-ink">
          FarmWatch
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-[15px] text-muted hover:text-ink">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          {me ? (
            <Link to="/app" className={`${BTN_PRIMARY} h-10`}>
              Open dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="hidden text-[15px] font-medium text-ink hover:text-primary md:inline">
                Log in
              </Link>
              <Link to="/signup" className={`${BTN_PRIMARY} h-10`}>
                Sign up
              </Link>
            </>
          )}
          <button
            type="button"
            className="h-10 rounded-md border border-line-strong px-3 text-[15px] font-medium text-ink hover:bg-page md:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((o) => !o)}
          >
            Menu
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-menu" aria-label="Main" className="border-t border-line md:hidden">
          <ul className={`${CONTAINER} flex flex-col py-2`}>
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={close} className="block py-3 text-ink">
                  {l.label}
                </a>
              </li>
            ))}
            {!me && (
              <li className="border-t border-line">
                <Link to="/login" onClick={close} className="block py-3 font-medium text-ink">
                  Log in
                </Link>
              </li>
            )}
          </ul>
        </nav>
      )}
    </header>
  )
}

export default function Landing() {
  return (
    <div className="min-h-dvh bg-surface text-base leading-[1.6] text-ink">
      <Header />

      <main>
        {/* 2. Hero */}
        <section aria-labelledby="hero-title" className={SECTION}>
          <div className={`${CONTAINER} grid items-center gap-12 lg:grid-cols-2 lg:gap-16`}>
            <div>
              <h1 id="hero-title" className="text-[32px] leading-[1.15] font-semibold tracking-[-0.02em] md:text-[44px]">
                Know how your herd is doing, without watching the barn all day
              </h1>
              <p className="mt-6 max-w-[34rem] text-lg text-muted">
                Connect your farm cameras or upload images and videos. The system finds each cow and shows whether it is standing,
                lying, eating, drinking or ruminating, and tells you when something looks wrong.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/signup" className={BTN_PRIMARY}>
                  Create a free account
                </Link>
                <Link to="/login" className={BTN_SECONDARY}>
                  Log in
                </Link>
              </div>
            </div>
            <Screenshot
              src={shotAnalyze}
              alt="Barn camera image analysed by the model: each cow has a box labelled standing, foraging or rumination with a confidence score"
              width={1334}
              height={1068}
              eager
            />
          </div>
        </section>

        {/* 3. How it works */}
        <section id="how-it-works" aria-labelledby="how-title" className={`${SECTION} scroll-mt-4 bg-page`}>
          <div className={CONTAINER}>
            <h2 id="how-title" className={H2}>
              How it works
            </h2>
            <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-12">
              {STEPS.map((s) => (
                <li key={s.n}>
                  <p className="text-[15px] font-medium text-muted tabular-nums">{s.n}</p>
                  <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-muted">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 4. Behaviours */}
        <section id="behaviours" aria-labelledby="behaviours-title" className={`${SECTION} scroll-mt-4`}>
          <div className={`${CONTAINER} grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16`}>
            <div>
              <h2 id="behaviours-title" className={H2}>
                Five behaviours, recognised from video
              </h2>
              <p className="mt-4 max-w-md text-muted">These behaviours are early signs of comfort, feeding and health.</p>
            </div>
            <ul className="flex flex-col gap-4">
              {BEHAVIOURS.map((b) => (
                <li key={b.name} className="border-l-4 py-1 pl-4" style={{ borderLeftColor: b.color }}>
                  <p className="font-semibold">{b.name}</p>
                  <p className="text-muted">{b.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 5. Features */}
        <section id="features" aria-labelledby="features-title" className={`${SECTION} scroll-mt-4 bg-page`}>
          <div className={CONTAINER}>
            <h2 id="features-title" className={H2}>
              Everything the farm team needs
            </h2>
            <div className="mt-12 flex flex-col gap-16 md:gap-20">
              {FEATURES.map((f, i) => (
                <div key={f.title} className="grid items-center gap-8 md:grid-cols-2 md:gap-16">
                  <div className={i % 2 === 1 ? 'md:order-2' : undefined}>
                    <h3 className="text-xl font-semibold">{f.title}</h3>
                    <p className="mt-3 max-w-md text-muted">{f.text}</p>
                  </div>
                  <div className={i % 2 === 1 ? 'md:order-1' : undefined}>
                    <Screenshot src={f.shot.src} alt={f.shot.alt} width={1600} height={1000} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 6. Honest note */}
        <section aria-labelledby="expect-title" className={SECTION}>
          <div className={CONTAINER}>
            <div className="max-w-[640px]">
              <h2 id="expect-title" className={H2}>
                What to expect
              </h2>
              <p className="mt-4 text-muted">
                The model was trained on the public CBVD-5 dataset from a real dairy barn. Foraging and standing are recognised most
                reliably. Rumination is harder to judge from a single frame, so treat it as a guide, not a diagnosis.
              </p>
            </div>
          </div>
        </section>

        {/* 7. Final call to action */}
        <section aria-labelledby="cta-title" className={`${SECTION} bg-primary text-white`}>
          <div className={CONTAINER}>
            <h2 id="cta-title" className={H2}>
              Start monitoring your herd today
            </h2>
            <p className="mt-4 max-w-xl text-white/90">
              Create an account, set up your workspace and add your first camera in a few minutes.
            </p>
            <Link
              to="/signup"
              className={`${BTN} mt-8 bg-white text-primary hover:bg-primary-soft focus-visible:outline-white`}
            >
              Create a free account
            </Link>
          </div>
        </section>
      </main>

      {/* 8. Footer */}
      <footer className="border-t border-line bg-surface">
        <div className={`${CONTAINER} flex flex-col gap-6 py-10 sm:flex-row sm:items-start sm:justify-between`}>
          <div className="text-[15px]">
            <p className="font-semibold text-ink">FarmWatch</p>
            <p className="mt-1 text-muted">Final Year Project, Lahore Garrison University</p>
          </div>
          <nav aria-label="Account" className="flex gap-6 text-[15px]">
            <Link to="/login" className="text-muted hover:text-ink">
              Log in
            </Link>
            <Link to="/signup" className="text-muted hover:text-ink">
              Sign up
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
