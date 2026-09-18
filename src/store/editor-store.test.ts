import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { EDITOR_PREFERENCES_KEY, readEditorPreferences, useEditorStore } from './editor-store'

type Stored = Record<string, unknown>
const getStored = (): unknown => {
  const raw = localStorage.getItem(EDITOR_PREFERENCES_KEY)
  return raw ? JSON.parse(raw) : null
}

describe('editor store', () => {
  beforeEach(() => useEditorStore.setState({
    selectedIds: [],
    detailsOpen: false,
    viewport: { x: 0, y: 0, zoom: 1 },
    dialog: 'none',
    isSavePending: false,
    canvasTool: 'select',
    sidebarOpen: true,
    sidebarWidth: 260,
    sidebarSections: { projects: true, outline: true, notes: true },
    minimapVisible: true,
  }))
  afterEach(() => localStorage.removeItem(EDITOR_PREFERENCES_KEY))
  it('keeps UI selection out of the project document', () => {
    useEditorStore.getState().setSelectedIds(['a'])
    useEditorStore.getState().setSavePending(true)
    useEditorStore.getState().setViewport({ x: 48, y: -16, zoom: 1.25 })
    useEditorStore.getState().setDialog('project-settings')
    expect(useEditorStore.getState().selectedIds).toEqual(['a'])
    expect(useEditorStore.getState().isSavePending).toBe(true)
    expect(useEditorStore.getState().viewport).toEqual({ x: 48, y: -16, zoom: 1.25 })
    expect(useEditorStore.getState().dialog).toBe('project-settings')
  })
  it('starts with the details drawer closed and only opens it with a single selection', () => {
    expect(useEditorStore.getState().detailsOpen).toBe(false)
    useEditorStore.getState().setDetailsOpen(true)
    expect(useEditorStore.getState().detailsOpen).toBe(false)
    useEditorStore.getState().setSelectedIds(['node-1'])
    useEditorStore.getState().setDetailsOpen(true)
    expect(useEditorStore.getState().detailsOpen).toBe(true)
    useEditorStore.getState().setSelectedIds([])
    expect(useEditorStore.getState().detailsOpen).toBe(false)
  })
  it('persists sidebar preferences and clamps the width', () => {
    useEditorStore.getState().setSidebarOpen(false)
    useEditorStore.getState().setSidebarWidth(800)
    useEditorStore.getState().toggleSidebarSection('outline')
    const stored = getStored() as Stored
    expect(stored.sidebarOpen).toBe(false)
    expect(stored.sidebarWidth).toBe(360)
    expect(stored.sidebarSections).toEqual({ projects: true, outline: false, notes: true })
  })
  it('falls back to defaults when localStorage throws', () => {
    const original = localStorage.setItem
    localStorage.setItem = () => { throw new Error('quota') }
    try {
      useEditorStore.getState().setSidebarOpen(false)
      expect(useEditorStore.getState().sidebarOpen).toBe(false)
    } finally { localStorage.setItem = original }
  })
  it('reads stored preferences and ignores corrupt values', () => {
    localStorage.setItem(EDITOR_PREFERENCES_KEY, JSON.stringify({ sidebarOpen: false, sidebarWidth: 300, minimapVisible: false }))
    expect(readEditorPreferences()).toMatchObject({ sidebarOpen: false, sidebarWidth: 300, minimapVisible: false })
    localStorage.setItem(EDITOR_PREFERENCES_KEY, '{not json')
    expect(readEditorPreferences().sidebarWidth).toBe(260)
  })
})
