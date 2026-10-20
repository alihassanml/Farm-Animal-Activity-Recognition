import { Bell, ScanSearch, Video } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Logo } from '../components/layout/Logo'
import { ButtonLink } from '../components/ui/Button'
import { useAuth } from '../context/auth'
import { BEHAVIOUR_COLOR, BEHAVIOUR_LABEL, BEHAVIOURS } from '../lib/behaviour'

const FEATURES = [
  {
    icon: ScanSearch,
    title: 'Analyze images and video',
    text: 'Upload a photo or a clip from the barn. Each cow is boxed and labelled with what it is doing.',
  },
  {
    icon: Video,
    title: 'Monitor live cameras',
    text: 'Connect a webcam or an RTSP camera. Behaviour is sampled every second and saved to the activity log.',
  },
  {
    icon: Bell,
    title: 'Alerts for unusual behaviour',
    text: 'Set simple rules such as too much lying or no drinking for hours, and get alerts on the dashboard.',
  },
]

const STEPS = [
  ['Add footage', 'Upload an image or video, or connect a farm camera.'],
  ['Detect behaviour', 'A YOLO11 model trained on the CBVD-5 cattle dataset finds every cow and its behaviour.'],
  ['Review activity', 'See behaviour charts on the dashboard and filter or export the activity log.'],
  ['Act on alerts', 'Rules check each camera and raise alerts your team can acknowledge.'],
]

const BEHAVIOUR_TEXT = {
  standing: 'On its feet, not eating or drinking',
  lying: 'Lying down and resting',
  foraging: 'Eating at the feed area',
  drinking: 'Drinking at the water trough',
  rumination: 'Chewing the cud',
}

export default function Landing() {
  const { me } = useAuth()

  return (
    <div className="min-h-dvh bg-surface">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 sm:px-6">
          <Link to="/" aria-label="Farm Activity home">
            <Logo />
          </Link>
          <nav className="flex items-center gap-2">
            {me ? (
              <ButtonLink to="/app">Open dashboard</ButtonLink>
            ) : (
              <>
                <ButtonLink to="/login" variant="ghost">
                  Log in
                </ButtonLink>
                <ButtonLink to="/signup">Sign up</ButtonLink>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-[1200px] items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:py-24">
          <div>
            <h1 className="text-[34px] leading-tight font-semibold sm:text-[40px]">Know what your herd is doing without watching all day</h1>
            <p className="mt-4 max-w-xl text-lg text-muted">
              Farm Activity detects cows in camera images and video and recognises five behaviours, so your team can spot
              problems early and keep a record of herd activity.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {me ? (
                <ButtonLink to="/app">Open dashboard</ButtonLink>
              ) : (
                <>
                  <ButtonLink to="/signup">Create an account</ButtonLink>
                  <ButtonLink to="/login" variant="secondary">
                    Log in
                  </ButtonLink>
                </>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-line bg-page p-5">
            <p className="text-sm font-medium text-muted">Behaviours the model recognises</p>
            <ul className="mt-3 divide-y divide-line">
              {BEHAVIOURS.map((b) => (
                <li key={b} className="flex items-center gap-3 py-3">
                  <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: BEHAVIOUR_COLOR[b] }} aria-hidden />
                  <span className="w-28 font-medium">{BEHAVIOUR_LABEL[b]}</span>
                  <span className="text-sm text-muted">{BEHAVIOUR_TEXT[b]}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-y border-line bg-page">
          <div className="mx-auto grid max-w-[1200px] gap-6 px-4 py-16 sm:px-6 md:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-lg border border-line bg-surface p-6">
                <Icon className="size-[18px] text-primary" aria-hidden />
                <h2 className="mt-4 text-lg">{title}</h2>
                <p className="mt-2 text-muted">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6">
          <h2>How it works</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([title, text], i) => (
              <li key={title}>
                <span className="flex size-8 items-center justify-center rounded-md bg-primary-soft text-sm font-semibold text-primary">{i + 1}</span>
                <h3 className="mt-3 text-base">{title}</h3>
                <p className="mt-1 text-muted">{text}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-[1200px] px-4 py-6 text-sm text-muted sm:px-6">
          Final Year Project, BSCS — Department of Computer Science, Lahore Garrison University
        </div>
      </footer>
    </div>
  )
}
