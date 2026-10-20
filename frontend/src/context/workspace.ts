import { createContext, useContext } from 'react'
import type { WorkspaceSummary } from '../api/types'

export interface WorkspaceValue {
  workspace: WorkspaceSummary
  isAdmin: boolean
  /** Builds a path inside the current workspace, e.g. path('alerts') -> /w/3/alerts */
  path: (page: string) => string
}

export const WorkspaceContext = createContext<WorkspaceValue | null>(null)

export function useWorkspace(): WorkspaceValue {
  const v = useContext(WorkspaceContext)
  if (!v) throw new Error('useWorkspace must be used inside a workspace route')
  return v
}
