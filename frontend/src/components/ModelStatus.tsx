import { healthApi } from '../api/endpoints'
import { useAsync } from '../hooks/useAsync'
import { Notice } from './ui/States'

/** Warns when the backend could not load the YOLO model (analysis and cameras won't work). */
export function ModelStatus() {
  const { data } = useAsync(() => healthApi.get(), [])
  if (!data || data.model_loaded) return null
  return (
    <div className="mb-6">
      <Notice tone="warning">
        The detection model is not loaded, so analysis and camera monitoring are unavailable.
        {data.model_error && <span className="mt-1 block text-ink">{data.model_error}</span>}
      </Notice>
    </div>
  )
}
