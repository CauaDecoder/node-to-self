import { create } from 'zustand'
import { z } from 'zod'

export type Dialog = 'none' | 'project-settings' | 'palette'
export type Viewport = { x: number; y: number; zoom: number }
export type SidebarSection = 'projects' | 'outline' | 'notes'
export const EDITOR_PREFERENCES_KEY = 'mind-map.editor-preferences'
const preferencesSchema = z.object({
  sidebarOpen: z.boolean().default(true),
  sidebarWidth: z.number().finite().transform((value) => Math.min(360, Math.max(220, value))).default(260),
  sidebarSections: z.object({ projects: z.boolean(), outline: z.boolean(), notes: z.boolean() }).default({ projects: true, outline: true, notes: true }),
  minimapVisible: z.boolean().default(true),
})
type Preferences = z.infer<typeof preferencesSchema>
export function readEditorPreferences(): Preferences {
  let preferences = preferencesSchema.parse({})
  try {
    const parsed = preferencesSchema.safeParse(JSON.parse(localStorage.getItem(EDITOR_PREFERENCES_KEY) ?? '{}'))
    if (parsed.success) preferences = parsed.data
  } catch {}
  if (typeof window !== 'undefined' && window.innerWidth < 760) preferences.sidebarOpen = false
  return preferences
}
function persistPreferences(state: Preferences): void {
  try { localStorage.setItem(EDITOR_PREFERENCES_KEY, JSON.stringify(preferencesSchema.parse(state))) } catch {}
}
type EditorState = Preferences & {
  selectedIds: string[]
  detailsOpen: boolean
  viewport: Viewport
  dialog: Dialog
  isSavePending: boolean
  canvasTool: 'select' | 'pan'
  setSelectedIds: (ids: string[]) => void
  setDetailsOpen: (open: boolean) => void
  setSidebarOpen: (open: boolean) => void
  setSidebarWidth: (width: number) => void
  toggleSidebarSection: (section: SidebarSection) => void
  setMinimapVisible: (visible: boolean) => void
  setCanvasTool: (tool: 'select' | 'pan') => void
  setViewport: (viewport: Viewport) => void
  setDialog: (dialog: Dialog) => void
  setSavePending: (pending: boolean) => void
}
export const useEditorStore = create<EditorState>((set, get) => {
  const updatePreferences = (patch: Partial<Preferences>): void => { set(patch); persistPreferences(get()) }
  return {
    ...readEditorPreferences(), selectedIds: [], detailsOpen: false, viewport: { x: 0, y: 0, zoom: 1 }, dialog: 'none', isSavePending: false, canvasTool: 'select',
    setSelectedIds: (selectedIds) => set((state) => state.selectedIds.length === selectedIds.length && state.selectedIds.every((id, index) => id === selectedIds[index]) ? state : { selectedIds, ...(selectedIds.length ? {} : { detailsOpen: false }) }),
    setDetailsOpen: (detailsOpen) => set({ detailsOpen: detailsOpen && get().selectedIds.length === 1 }),
    setSidebarOpen: (sidebarOpen) => updatePreferences({ sidebarOpen }),
    setSidebarWidth: (width) => { if (Number.isFinite(width)) updatePreferences({ sidebarWidth: Math.min(360, Math.max(220, width)) }) },
    toggleSidebarSection: (section) => updatePreferences({ sidebarSections: { ...get().sidebarSections, [section]: !get().sidebarSections[section] } }),
    setMinimapVisible: (minimapVisible) => updatePreferences({ minimapVisible }),
    setCanvasTool: (canvasTool) => set({ canvasTool }),
    setViewport: (viewport) => set({ viewport }),
    setDialog: (dialog) => set({ dialog }),
    setSavePending: (isSavePending) => set({ isSavePending }),
  }
})
