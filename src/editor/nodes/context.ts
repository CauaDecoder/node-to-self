import { createContext, useContext } from 'react'
import type { NodeEntity, GroupEntity, NoteEntity } from '../../domain/project'

export type EditRequest = { nodeId: string; target: 'title' | 'body'; sequence: number }
export type EditorActions = {
  editRequest: EditRequest | null
  updateNode: (id: string, patch: Partial<Pick<NodeEntity, 'title' | 'description'>>) => void
  resizeNode: (id: string, size: NodeEntity['size'], position: NodeEntity['position']) => void
  resizeGroup: (id: string, size: GroupEntity['size'], position: GroupEntity['position']) => void
  updateGroup: (id: string, patch: Partial<Pick<GroupEntity, 'title' | 'color'>>) => void
  updateNote: (id: string, patch: Partial<Pick<NoteEntity, 'title' | 'markdown'>>) => void
  resizeNote: (id: string, size: { width: number; height: number }, position: { x: number; y: number }) => void
}

export const EditorActionsContext = createContext<EditorActions | null>(null)
export function useEditorActions(): EditorActions {
  const actions = useContext(EditorActionsContext)
  if (!actions) throw new Error('Editor actions require a Canvas provider.')
  return actions
}
