import { healthApi } from '../api/endpoints'
import { useAsync } from '../hooks/useAsync'
import { Notice } from './ui/States'

/** Warns when the backend could not load the YOLO model or open the database. */
export function ModelStatus() {
  const { data } = useAsync(() => healthApi.get(), [])
  if (!data || (data.model_loaded && data.database_ok !== false)) return null
  return (
    <div className="mb-6 flex flex-col gap-2">
      {!data.model_loaded && (
        <Notice tone="warning">
          The detection model is not loaded, so analysis and camera monitoring are unavailable.
          {data.model_error && <span className="mt-1 block text-ink">{data.model_error}</span>}
          <span className="mt-1 block text-ink">Run python backend/doctor.py on the server to see how to fix it.</span>
        </Notice>
      )}
      {data.database_ok === false && (
        <Notice>
          The database can’t be opened, so data can’t be saved.
          {data.database_error && <span className="mt-1 block text-ink">{data.database_error}</span>}
        </Notice>
      )}
    </div>
  )
}
