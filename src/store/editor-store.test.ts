import { beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore } from './editor-store'

describe('editor store', () => {
  beforeEach(() => useEditorStore.setState({
    selectedIds: [],
    inspectorPanel: 'inspector',
    viewport: { x: 0, y: 0, zoom: 1 },
    dialog: 'none',
    isSavePending: false,
  }))
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
})
