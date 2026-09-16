import { create } from 'zustand'

export type InspectorPanel = 'inspector' | 'none'
export type Dialog = 'none' | 'project-settings'
export type Viewport = { x: number; y: number; zoom: number }

type EditorState = {
  selectedIds: string[]
  inspectorPanel: InspectorPanel
  viewport: Viewport
  dialog: Dialog
  isSavePending: boolean
  setSelectedIds: (ids: string[]) => void
  setInspectorPanel: (panel: InspectorPanel) => void
  setViewport: (viewport: Viewport) => void
  setDialog: (dialog: Dialog) => void
  setSavePending: (pending: boolean) => void
}

export const useEditorStore = create<EditorState>((set) => ({
  selectedIds: [],
  inspectorPanel: 'inspector',
  viewport: { x: 0, y: 0, zoom: 1 },
  dialog: 'none',
  isSavePending: false,
  setSelectedIds: (selectedIds) => set((state) => state.selectedIds.length === selectedIds.length && state.selectedIds.every((id, index) => id === selectedIds[index]) ? state : { selectedIds }),
  setInspectorPanel: (inspectorPanel) => set({ inspectorPanel }),
  setViewport: (viewport) => set({ viewport }),
  setDialog: (dialog) => set({ dialog }),
  setSavePending: (isSavePending) => set({ isSavePending }),
}))
