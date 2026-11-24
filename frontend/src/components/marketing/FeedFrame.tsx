import barn1600 from '../../assets/feed/barn-1600.webp'
import barn960 from '../../assets/feed/barn-960.webp'
import { Sparkline } from '../ui/DataViz'

/**
 * Product visual: one camera tile as it appears in the app. The frame is a real barn camera
 * image; the boxes and confidences are the real output of the trained YOLO11 model on it
 * (normalised x1, y1, x2, y2). Track numbers are illustrative.
 */
type Box = { id?: number; label: string; conf: number; b: [number, number, number, number] }

const BOXES: Box[] = [
  { id: 31, label: 'foraging', conf: 0.82, b: [0.0393, 0.484, 0.1786, 0.755] },
  { id: 118, label: 'standing', conf: 0.8, b: [0.603, 0.305, 0.6767, 0.5351] },
  { id: 64, label: 'standing', conf: 0.79, b: [0.3949, 0.2464, 0.5218, 0.3824] },
  { label: 'standing', conf: 0.77, b: [0.1679, 0.3053, 0.2542, 0.447] },
  { id: 142, label: 'standing', conf: 0.77, b: [0.7014, 0.6089, 0.9481, 0.9811] },
  { id: 56, label: 'standing', conf: 0.76, b: [0.2626, 0.2998, 0.3864, 0.4875] },
  { label: 'standing', conf: 0.75, b: [0.5202, 0.6445, 0.8039, 0.9963] },
  { label: 'standing', conf: 0.72, b: [0.5395, 0.2905, 0.6133, 0.3885] },
  { label: 'standing', conf: 0.67, b: [0.6771, 0.3903, 0.7978, 0.6819] },
  { label: 'standing', conf: 0.63, b: [0.3068, 0.3697, 0.4642, 0.5979] },
  { label: 'standing', conf: 0.53, b: [0.9593, 0.5424, 1.0, 0.8565] },
  { label: 'standing', conf: 0.53, b: [0.1216, 0.28, 0.1799, 0.3939] },
]

// Detections per minute over the last hour (illustrative), drawn with the dashboard sparkline.
const ACTIVITY = [9, 11, 10, 12, 14, 13, 12, 15, 16, 14, 13, 15, 17, 16, 15, 16, 18, 17, 16, 16]

export function FeedFrame({ className = '', eager = true }: { className?: string; eager?: boolean }) {
  return (
    <figure className={`overflow-hidden rounded-lg border border-line bg-white shadow-xs ${className}`}>
      <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="numeric text-xs text-ink">CAM-02</span>
          <span className="truncate text-xs text-secondary">Water trough, south side</span>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-xs text-secondary">
          <span>Live</span>
          <span className="numeric hidden text-muted sm:inline">18:00:03</span>
        </div>
      </div>

      <div className="@container relative aspect-video bg-ink">
        <img
          src={barn1600}
          srcSet={`${barn960} 960w, ${barn1600} 1600w`}
          sizes="(min-width: 1024px) 640px, 100vw"
          alt="Barn camera view of a water trough with cows, each one outlined by a detection box"
          width={1600}
          height={900}
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : 'auto'}
          className="absolute inset-0 size-full object-cover"
        />
        {BOXES.map((x, i) => {
          const [x1, y1, x2, y2] = x.b
          return (
            <div
              key={i}
              className="absolute border-2 border-peach-600"
              style={{ left: `${x1 * 100}%`, top: `${y1 * 100}%`, width: `${(x2 - x1) * 100}%`, height: `${(y2 - y1) * 100}%` }}
            >
              {x.id && (
                <span
                  className={`feed-label numeric absolute bottom-full z-10 bg-peach-600 px-1 whitespace-nowrap text-ink ${
                    x1 > 0.65 ? '-right-0.5' : '-left-0.5' /* right-side boxes anchor the label right so it stays in frame */
                  }`}
                >
                  #{x.id} {x.label} {x.conf.toFixed(2)}
                </span>
              )}
            </div>
          )
        })}
      </div>

      <figcaption className="grid grid-cols-3 divide-x divide-line border-t border-line">
        <div className="px-4 py-3">
          <p className="text-xs text-muted">In view</p>
          <p className="numeric mt-1 text-h3 font-medium text-ink">13</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs text-muted">Activity, last hour</p>
          <Sparkline values={ACTIVITY} height={28} className="mt-2" />
        </div>
        <div className="px-4 py-3">
          <p className="text-xs text-muted">Herd</p>
          <p className="mt-2 text-sm text-ink">Healthy</p>
        </div>
      </figcaption>
    </figure>
  )
}
