import { ArrowRight } from 'lucide-react'
import { MotionConfig } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Behaviour } from '../api/types'
import { Logo } from '../components/layout/Logo'
import { FeedFrame } from '../components/marketing/FeedFrame'
import { Reveal, Stagger, StaggerItem } from '../components/marketing/Reveal'
import { Badge, BehaviourBadge, Swatch } from '../components/ui/Badge'
import { buttonClass } from '../components/ui/buttonStyles'
import { ShareBar } from '../components/ui/DataViz'
import { useAuth } from '../context/auth'
import { BEHAVIOUR_COLOR, BEHAVIOURS } from '../lib/behaviour'
import { BRAND, DEMO_URL } from '../lib/brand'

/* Landing page ("/").
   Every number here comes from the project's own results (README, Explain.md): test-set mAP50
   of the final 4-class YOLO11s model, CPU frame rate, and the alert check interval.
   Charts marked "example" use illustrative data drawn with the same components as the app. */

const NAV_LINKS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#features', label: 'Features' },
  { href: '#metrics', label: 'Performance' },
]

const BUILT_WITH = ['YOLO11', 'CBVD-5 barn footage', 'RTSP and IP cameras', 'FastAPI', 'Lahore Garrison University']

/** Shown in development only until a real, attributable quote from a pilot farm is supplied. */
const TESTIMONIAL: { quote: string; name: string; farm: string } | null = import.meta.env.DEV
  ? {
      quote:
        'We used to find out a cow was off her feed at milking. Now the alert comes in while she is still standing at the trough, and we can walk straight to her.',
      name: '[Placeholder: farm owner name]',
      farm: '[Placeholder: farm name, region]',
    }
  : null

export default function Landing() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-dvh bg-white text-ink">
        <Header />
        <main>
          <Hero />
          <BuiltWith />
          <Problem />
          <HowItWorks />
          <Features />
          <Metrics />
          {TESTIMONIAL && <Testimonial t={TESTIMONIAL} />}
          <FinalCta />
        </main>
        <Footer />
      </div>
    </MotionConfig>
  )
}

/* ---------------------------------------------------------------- Header */

function Header() {
  const { me } = useAuth()
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white">
      <div className="container-site flex h-16 items-center justify-between gap-6">
        <Link to="/" aria-label={`${BRAND} home`}>
          <Logo />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-sm text-secondary transition-colors duration-150 hover:text-ink">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {me ? (
            <Link to="/app" className={buttonClass('primary', 'sm')}>
              Open dashboard
            </Link>
          ) : (
            <>
              <span className="hidden md:block">
                <Link to="/login" className={buttonClass('ghost', 'sm')}>
                  Log in
                </Link>
              </span>
              <span className="hidden sm:block">
                <Link to="/signup" className={buttonClass('secondary', 'sm')}>
                  Sign up
                </Link>
              </span>
            </>
          )}
          <button
            type="button"
            className={buttonClass('ghost', 'sm', 'md:hidden')}
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
          <ul className="container-site flex flex-col py-2">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={close} className="block py-3 text-ink">
                  {l.label}
                </a>
              </li>
            ))}
            {!me && (
              <>
                <li className="border-t border-line">
                  <Link to="/login" onClick={close} className="block py-3 text-ink">
                    Log in
                  </Link>
                </li>
                <li>
                  <Link to="/signup" onClick={close} className="block py-3 text-ink">
                    Sign up
                  </Link>
                </li>
              </>
            )}
          </ul>
        </nav>
      )}
    </header>
  )
}

/* ---------------------------------------------------------- Shared bits */

function SectionIntro({ eyebrow, title, children, id }: { eyebrow: string; title: string; children?: ReactNode; id: string }) {
  return (
    <Reveal className="max-w-prose">
      <p className="text-sm text-muted">{eyebrow}</p>
      <h2 id={id} className="mt-4 text-h2">
        {title}
      </h2>
      {children && <p className="mt-6 text-lg text-secondary">{children}</p>}
    </Reveal>
  )
}

/** White panel holding a piece of real UI inside a feature block. */
function UiPanel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-sm border border-line bg-white ${className}`}>{children}</div>
}

/* ------------------------------------------------------------------ Hero */

function Hero() {
  return (
    <section aria-labelledby="hero-title" className="section-y">
      <div className="container-site grid items-center gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16">
        <div>
          <Reveal>
            <p className="text-sm text-secondary">Computer vision for dairy farms</p>
          </Reveal>
          <Reveal delay={0.06}>
            <h1 id="hero-title" className="mt-4 text-display">
              Real-time eyes on every cow in your barn
            </h1>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="mt-6 max-w-prose text-lg text-secondary">
              {BRAND} connects to your barn cameras, recognises what each cow is doing, and alerts your team when eating,
              drinking or resting patterns change.
            </p>
          </Reveal>
          <Reveal delay={0.18}>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={DEMO_URL} className={buttonClass('primary', 'md')} data-qa="hero-cta">
                Book a demo
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <a href="#how-it-works" className={buttonClass('secondary', 'md')}>
                See how it works
              </a>
            </div>
          </Reveal>
        </div>
        <Reveal delay={0.1}>
          <FeedFrame />
        </Reveal>
      </div>
    </section>
  )
}

function BuiltWith() {
  return (
    <section aria-label="Built with" className="border-y border-line">
      <div className="container-site flex flex-col gap-3 py-6 md:flex-row md:items-center md:gap-12">
        <p className="shrink-0 text-xs text-muted">Built with</p>
        <ul className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted">
          {BUILT_WITH.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* --------------------------------------------------------------- Problem */

const PROBLEMS = [
  {
    title: 'Health signs get missed',
    text: 'A cow that eats less, drinks less or lies down far more than usual is often getting sick or lame. Between walk-throughs, nobody sees it.',
  },
  {
    title: 'Counting is still done by hand',
    text: 'Headcounts happen pen by pen, several times a day, and are out of date the moment the herd moves.',
  },
  {
    title: 'Every check costs labour',
    text: 'Night walks, feed-lane checks and trough checks add up to hours a day that a small team does not have.',
  },
]

function Problem() {
  return (
    <section aria-labelledby="problem-title" className="section-y">
      <div className="container-site grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16">
        <SectionIntro id="problem-title" eyebrow="The problem" title="Most health problems show up in behaviour first">
          The signs are there in the barn every day. The hard part is having someone watching at the right moment.
        </SectionIntro>
        <Stagger as="ul" className="border-t border-line">
          {PROBLEMS.map((p) => (
            <StaggerItem as="li" key={p.title} className="grid gap-2 border-b border-line py-6 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-8">
              <h3 className="text-base font-semibold">{p.title}</h3>
              <p className="text-secondary">{p.text}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------- How it works */

const STEPS = [
  {
    title: 'Cameras installed',
    text: 'Use the IP cameras already in your barn, or add new ones. Any RTSP or HTTP stream, a USB webcam, or a recorded video.',
    detail: 'RTSP · HTTP · USB · MP4',
  },
  {
    title: 'YOLO detects in real time',
    text: 'A YOLO11 model trained on real barn footage finds every cow, gives it a number while it stays in view, and labels what it is doing.',
    detail: '4 behaviours, YOLO11s model',
  },
  {
    title: 'Alerts and insights',
    text: 'The dashboard shows the day’s activity, and your team is alerted when the herd lies too much or stops eating or drinking.',
    detail: 'Rules checked every 60 s',
  },
]

function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="section-y scroll-mt-16 border-t border-line">
      <div className="container-site">
        <SectionIntro id="how-title" eyebrow="How it works" title="From camera to alert in three steps" />
        <Stagger as="ol" className="mt-16 grid gap-12 md:grid-cols-3 md:gap-8">
          {STEPS.map((s, i) => (
            <StaggerItem as="li" key={s.title} className="border-t border-line-strong pt-6">
              <p className="numeric text-xs text-muted">0{i + 1}</p>
              <h3 className="mt-2 text-h3">{s.title}</h3>
              <p className="mt-4 max-w-prose text-secondary">{s.text}</p>
              <p className="numeric mt-6 text-xs text-muted">{s.detail}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  )
}

/* --------------------------------------------------------------- Features */

function Features() {
  return (
    <section id="features" aria-labelledby="features-title" className="section-y scroll-mt-16 border-t border-line bg-surface-alt">
      <div className="container-site">
        <SectionIntro id="features-title" eyebrow="Features" title="Everything the farm team needs to watch, in one place">
          Built for the people who run the barn: clear numbers, few alerts, and nothing to configure that you do not need.
        </SectionIntro>

        <Stagger className="mt-16 grid gap-6 lg:grid-cols-12">
          <FeatureBlock
            fill
            className="lg:col-span-7 lg:row-span-2"
            title="Behaviour tracking"
            text="Standing, lying, eating and drinking, for every cow in view, around the clock. See how the herd spent the last 24 hours at a glance."
          >
            <UiPanel className="flex h-full flex-col p-6">
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-sm font-medium">Activity over the last 24 hours</p>
                <p className="text-xs text-muted">Example day</p>
              </div>
              <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2" aria-hidden>
                {BEHAVIOURS.map((b) => (
                  <li key={b}>
                    <BehaviourBadge behaviour={b} />
                  </li>
                ))}
              </ul>
              <StackedArea className="mt-6 flex flex-1 flex-col" />
            </UiPanel>
          </FeatureBlock>

          <FeatureBlock
            className="lg:col-span-5"
            title="Automatic headcount"
            text="Every camera counts the cows it sees, continuously. No clipboards."
          >
            <UiPanel>
              {[
                { cam: 'Barn A, feed lane', n: 16 },
                { cam: 'Water trough', n: 9 },
                { cam: 'Resting area', n: 13 },
              ].map((r) => (
                <div key={r.cam} className="flex items-center gap-4 border-b border-line px-4 py-3 text-sm last:border-b-0">
                  <span className="min-w-0 flex-1 truncate">{r.cam}</span>
                  <span className="hidden w-24 sm:flex">
                    <ShareBar behaviour="standing" percent={(r.n / 16) * 100} />
                  </span>
                  <span className="numeric w-8 text-right">{r.n}</span>
                </div>
              ))}
            </UiPanel>
          </FeatureBlock>

          <FeatureBlock
            className="lg:col-span-5"
            title="Health and lameness signs"
            text="Too much lying and too little eating are early signs of illness or lameness. Both are tracked for the whole herd."
          >
            <UiPanel className="flex flex-col gap-4 p-4">
              <div>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Swatch behaviour="lying" /> Lying
                  </span>
                  <span className="numeric">38%</span>
                </div>
                <div className="mt-2 flex">
                  <ShareBar behaviour="lying" percent={38} />
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-line pt-4 text-sm">
                <span className="flex items-center gap-2">
                  <Swatch behaviour="foraging" /> Eating
                </span>
                <span className="text-secondary">Within normal range</span>
              </div>
            </UiPanel>
          </FeatureBlock>

          <FeatureBlock
            className="lg:col-span-5"
            title="Feeding and water monitoring"
            text="Know when each feeding area and trough last saw activity, without walking over to check."
          >
            <UiPanel>
              {[
                { l: 'Last eating seen', v: '2 min ago' },
                { l: 'Last drinking seen', v: '14 min ago' },
                { l: 'Eating today', v: '21% of detections' },
              ].map((r) => (
                <div key={r.l} className="flex items-center justify-between gap-4 border-b border-line px-4 py-3 text-sm last:border-b-0">
                  <span className="text-secondary">{r.l}</span>
                  <span className="numeric">{r.v}</span>
                </div>
              ))}
            </UiPanel>
          </FeatureBlock>

          <FeatureBlock
            className="lg:col-span-7"
            title="Real-time alerts"
            text="Rules run per camera and only trigger after enough data is collected, so one wrong detection never raises an alarm. Set the limits for your farm."
          >
            <UiPanel>
              {[
                { m: 'No drinking seen at Water trough in the last 2 hours', at: '4 min ago', tone: 'danger' as const, label: 'High' },
                { m: '74% of cows lying in Barn A over the last hour (limit 70%)', at: '31 min ago', tone: 'warning' as const, label: 'Medium' },
              ].map((a) => (
                <div key={a.m} className="flex items-start gap-4 border-b border-line px-4 py-3 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{a.m}</p>
                    <p className="numeric mt-1 text-xs text-muted">{a.at}</p>
                  </div>
                  <Badge tone={a.tone}>{a.label}</Badge>
                </div>
              ))}
            </UiPanel>
          </FeatureBlock>
        </Stagger>
      </div>
    </section>
  )
}

function FeatureBlock({
  title,
  text,
  children,
  className = '',
  fill = false,
}: {
  title: string
  text: string
  children: ReactNode
  className?: string
  /** Let the UI panel grow to the block's full height (used by the tall block). */
  fill?: boolean
}) {
  return (
    <StaggerItem className={`flex flex-col gap-6 rounded-md border border-line bg-white p-6 ${className}`}>
      <div>
        <h3 className="text-h3">{title}</h3>
        <p className="mt-2 text-secondary">{text}</p>
      </div>
      <div className={fill ? 'flex-1' : 'mt-auto'}>{children}</div>
    </StaggerItem>
  )
}

/** Stacked area chart of an example day, drawn like the dashboard chart (flat fills, white separators). */
function StackedArea({ className = '' }: { className?: string }) {
  const W = 600
  const H = 200
  const hours = Array.from({ length: 25 }, (_, i) => i)
  // Illustrative day: lying peaks at night, eating at the morning and evening feeds.
  const wave = (h: number, centre: number, width: number) => Math.exp(-((h - centre) ** 2) / (2 * width ** 2))
  const series: Record<Behaviour, number[]> = {
    standing: hours.map((h) => 18 + 10 * wave(h, 10, 3) + 8 * wave(h, 17, 2.5)),
    lying: hours.map((h) => 14 + 22 * wave(h, 2, 3.5) + 18 * wave(h, 23, 2.5) + 6 * wave(h, 13, 2)),
    foraging: hours.map((h) => 4 + 16 * wave(h, 7, 1.5) + 14 * wave(h, 18, 1.6)),
    drinking: hours.map((h) => 2 + 5 * wave(h, 8, 1.5) + 6 * wave(h, 15, 2) + 4 * wave(h, 19, 1.4)),
  }
  const max = hours.reduce((m, i) => Math.max(m, BEHAVIOURS.reduce((s, b) => s + series[b][i], 0)), 0) * 1.08
  const x = (i: number) => (i / 24) * W
  const y = (v: number) => H - (v / max) * H
  const base = hours.map(() => 0)
  const paths = BEHAVIOURS.map((b) => {
    const lower = [...base]
    const upper = base.map((v, i) => v + series[b][i])
    upper.forEach((v, i) => (base[i] = v))
    const top = upper.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
    const bottom = lower
      .map((v, i) => [i, v] as const)
      .reverse()
      .map(([i, v]) => `L${x(i).toFixed(1)},${y(v).toFixed(1)}`)
      .join(' ')
    return { b, d: `${top} ${bottom} Z` }
  })
  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="block min-h-48 w-full flex-1"
        role="img" aria-label="Example of the herd’s behaviour over a day, stacked by behaviour">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} stroke="var(--color-line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        {paths.map((p) => (
          <path
            key={p.b}
            d={p.d}
            fill={BEHAVIOUR_COLOR[p.b]}
            stroke="var(--color-white)"
            strokeWidth={1}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <line x1={0} x2={W} y1={H - 0.5} y2={H - 0.5} stroke="var(--color-line-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="numeric mt-2 flex justify-between text-xs text-muted" aria-hidden>
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>24:00</span>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- Metrics */

// Test-set mAP50 of the final 4-class YOLO11s model (test set split by video).
// Only these results are confirmed; do not add numbers that are not in the results.
// TODO: per-class mAP50 for standing, foraging and drinking on the final model (not supplied yet).
const MAP50: { key: string; label: string; v: number; main?: boolean; old?: boolean }[] = [
  { key: 'cbvd', label: 'CBVD-5', v: 0.762, main: true },
  { key: 'beef', label: 'Second barn', v: 0.918 },
  { key: 'both', label: 'Both combined', v: 0.769 },
  { key: 'old', label: 'Old model', v: 0.635, old: true },
]

// CPU speed of the final model, and how many frames a second monitoring stores per camera.
const CPU_FPS = 2.9
const MONITOR_FPS = 1

function Metrics() {
  return (
    <section id="metrics" aria-labelledby="metrics-title" className="section-y scroll-mt-16 border-t border-line">
      <div className="container-site">
        <SectionIntro id="metrics-title" eyebrow="Performance" title="Measured, not promised">
          Results on test videos the model never saw during training, and from running it on ordinary hardware.
        </SectionIntro>

        <Stagger className="mt-16 grid border-t border-line md:grid-cols-3">
          <Metric
            value="0.76"
            label="Detection accuracy (mAP50)"
            note="Standing, lying, eating and drinking, on the CBVD-5 test videos. Lying improved from 0.47 to 0.88."
          >
            <ul className="flex flex-col gap-2 text-xs" aria-label="mAP50 on each test set">
              {MAP50.map((m) => (
                <li key={m.key} className="flex items-center gap-3">
                  <span className={`w-24 shrink-0 ${m.main ? 'text-ink' : 'text-muted'}`}>{m.label}</span>
                  <span className="block h-2 flex-1 bg-surface-alt">
                    <span
                      className="block h-full"
                      style={{
                        width: `${m.v * 100}%`,
                        backgroundColor: m.old
                          ? 'var(--color-series-neutral)'
                          : m.main
                            ? 'var(--color-peach-600)'
                            : 'var(--color-peach-100)',
                        boxShadow: `inset 0 0 0 1px ${m.old ? 'var(--color-faint)' : 'var(--color-peach-600)'}`,
                      }}
                    />
                  </span>
                  <span className="numeric w-10 text-right text-ink">{m.v.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </Metric>

          <Metric
            value={`${CPU_FPS} fps`}
            label="On an ordinary laptop CPU"
            note="Monitoring stores 1 frame a second per camera, so a CPU is enough for one camera. Use a GPU for more."
          >
            <div className="flex flex-col gap-3 text-xs">
              <CapacityBar label="Model speed on CPU" value={CPU_FPS} max={CPU_FPS} scale="green" />
              <CapacityBar label="One camera, monitoring" value={MONITOR_FPS} max={CPU_FPS} scale="neutral" />
            </div>
          </Metric>

          <Metric value="60 s" label="Alert rules re-checked" note="Each rule needs enough data first, so one wrong detection never raises an alarm.">
            <div className="relative h-16" aria-hidden>
              <span className="absolute inset-x-0 top-1/2 h-px bg-line" />
              {Array.from({ length: 10 }, (_, i) => (
                <span
                  key={i}
                  className={`absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 ${i === 7 ? 'bg-peach-600' : 'bg-line-strong'}`}
                  style={{ left: `${(i / 9) * 100}%` }}
                />
              ))}
              <span className="numeric absolute top-0 text-xs text-muted" style={{ left: `${(7 / 9) * 100}%`, transform: 'translateX(-50%)' }}>
                alert
              </span>
            </div>
          </Metric>
        </Stagger>

        <Reveal>
          <div className="mt-12 max-w-prose border-t border-line pt-6 text-sm">
            <p className="font-medium text-ink">Known limits</p>
            <ul className="mt-2 flex flex-col gap-1 text-secondary">
              <li>Drinking is the weakest behaviour: the test set has only 71 drinking cows.</li>
              <li>On a laptop CPU the model runs at about 2.9 frames a second.</li>
              <li>Cow numbers last for one session only. They cannot follow a named cow across days.</li>
              <li>Rumination is not detected yet. It is planned as future work.</li>
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function Metric({ value, label, note, children }: { value: string; label: string; note: string; children: ReactNode }) {
  return (
    <StaggerItem className="flex flex-col border-b border-line py-8 md:border-r md:border-b-0 md:px-8 md:first:pl-0 md:last:border-r-0 md:last:pr-0">
      <p className="numeric text-h2 font-medium text-ink">{value}</p>
      <p className="mt-2 font-medium">{label}</p>
      <div className="mt-8">{children}</div>
      <p className="mt-6 text-xs text-muted">{note}</p>
    </StaggerItem>
  )
}

function CapacityBar({ label, value, max, scale }: { label: string; value: number; max: number; scale: 'green' | 'neutral' }) {
  return (
    <div>
      <div className="flex justify-between text-muted">
        <span>{label}</span>
        <span className="numeric text-ink">{value} fps</span>
      </div>
      <div className="mt-1 h-2 bg-surface-alt">
        <div
          className="h-full"
          style={{
            width: `${(value / max) * 100}%`,
            backgroundColor: scale === 'green' ? 'var(--color-green-300)' : 'var(--color-series-neutral)',
            boxShadow: `inset 0 0 0 1px ${scale === 'green' ? 'var(--color-green-600)' : 'var(--color-faint)'}`,
          }}
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------- Testimonial, CTA */

function Testimonial({ t }: { t: { quote: string; name: string; farm: string } }) {
  return (
    <section aria-label="What farmers say" className="section-y border-t border-line">
      <Reveal className="container-site">
        <figure>
          <blockquote className="text-h2 font-normal text-ink lg:w-4/5">“{t.quote}”</blockquote>
          <figcaption className="mt-8 text-sm">
            <span className="font-medium text-ink">{t.name}</span>
            <span className="block text-secondary">{t.farm}</span>
          </figcaption>
        </figure>
      </Reveal>
    </section>
  )
}

function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="section-y border-t border-line bg-surface-alt">
      <Reveal className="container-site flex flex-col items-center text-center">
        <h2 id="cta-title" className="max-w-prose text-h2">
          See it running on your own barn footage
        </h2>
        <p className="mt-6 max-w-prose text-lg text-secondary">We set it up with one of your cameras, and you decide from there.</p>
        <Link to={DEMO_URL} className={buttonClass('primary', 'md', 'mt-8')}>
          Book a demo
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </Reveal>
    </section>
  )
}

/* ----------------------------------------------------------------- Footer */

function Footer() {
  const col = 'flex flex-col gap-3 text-sm'
  const a = 'text-muted transition-colors duration-150 hover:text-ink'
  return (
    <footer className="border-t border-line">
      <div className="container-site grid gap-12 py-16 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-narrow text-sm text-muted">Real-time herd monitoring for dairy farms, from the cameras in your barn.</p>
        </div>
        <nav aria-label="Product" className={col}>
          <p className="text-xs text-ink">Product</p>
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className={a}>
              {l.label}
            </a>
          ))}
        </nav>
        <nav aria-label="Account" className={col}>
          <p className="text-xs text-ink">Account</p>
          <Link to="/login" className={a}>
            Log in
          </Link>
          <Link to="/signup" className={a}>
            Sign up
          </Link>
        </nav>
        <div className={col}>
          <p className="text-xs text-ink">Project</p>
          <p className="text-muted">Final Year Project, Lahore Garrison University</p>
        </div>
      </div>
      <div className="container-site">
        <p className="numeric border-t border-line py-6 text-xs text-muted">© {new Date().getFullYear()} {BRAND}</p>
      </div>
    </footer>
  )
}
