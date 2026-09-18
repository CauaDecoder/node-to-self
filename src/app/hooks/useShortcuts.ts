import { useEffect } from 'react'
import type { ReactFlowInstance } from '@xyflow/react'
import type { FlowEdge, FlowNode } from '../../editor/adapter'
import { useEditorStore } from '../../store/editor-store'
import { useProjectStore } from '../../store/project-store'
import { buildCommands } from '../actions'

export const isTextInput = (target: EventTarget | null): boolean => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

type ShortcutContext = {
  enabled: boolean
  flowInstance: ReactFlowInstance<FlowNode, FlowEdge> | null
  requestImport: () => void
  exportBackup: () => void
  exportMarkdown: () => void
  beginTitleEdit: (nodeId: string) => void
  addChildAndEditTitle: () => void
  addSiblingAndEditTitle: () => void
  addNodeAtViewportCenter: (typeId?: string) => void
  addLibraryNote: () => void
  confirm: (options: { title: string; description?: string; confirmLabel: string; danger?: boolean; onConfirm: () => void }) => void
  toggleSidebar: () => void
}

export function useShortcuts(context: ShortcutContext): void {
  useEffect(() => {
    if (!context.enabled) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isTextInput(event.target)) return
      const project = useProjectStore.getState().activeProject
      if (!project) return
      const editor = useEditorStore.getState()
      const selectedIds = editor.selectedIds
      const modifier = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()
      if (modifier && key === '\\') { event.preventDefault(); context.toggleSidebar(); return }
      if (modifier && key === 'i') { event.preventDefault(); editor.setDetailsOpen(!editor.detailsOpen); return }
      if (modifier && key === 'k') { event.preventDefault(); useEditorStore.getState().setDialog('palette'); return }
      const firstSelectedNode = selectedIds.find((id) => project.nodes.some((node) => node.id === id))
      if (!modifier && event.key === 'Tab' && firstSelectedNode) { event.preventDefault(); context.addChildAndEditTitle(); return }
      if (!modifier && event.key === 'Enter' && firstSelectedNode) { event.preventDefault(); context.addSiblingAndEditTitle(); return }
      if (!modifier && event.key === 'F2' && firstSelectedNode) { event.preventDefault(); context.beginTitleEdit(firstSelectedNode); return }
      if (!modifier && event.key.toLowerCase() === 'n') { event.preventDefault(); context.addNodeAtViewportCenter(); return }
      if (!modifier && event.key.toLowerCase() === 'f') { event.preventDefault(); void context.flowInstance?.fitView({ padding: 0.2 }); return }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedIds.length) {
        event.preventDefault()
        const command = buildCommands({ ...context, project, selection: { nodes: [], groups: [], connections: [], notes: [] } }).find((item) => item.id === 'delete')
        command?.run()
        return
      }
      const commands = buildCommands({ ...context, project, selection: { nodes: project.nodes.filter((node) => selectedIds.includes(node.id)), groups: [], connections: [], notes: [] } })
      const shortcutMatches = (shortcut: string | undefined): boolean => {
        if (!shortcut) return false
        const normalized = shortcut.toLowerCase()
        if (modifier && (normalized === 'ctrl/⌘+z' || normalized === 'ctrl/⌘+y' || normalized === 'ctrl/⌘+g' || normalized === 'ctrl/⌘+d')) return key === normalized.slice(-1)
        if (modifier && normalized.startsWith('ctrl/⌘+')) return key === normalized.slice(7)
        return false
      }
      const command = commands.find((item) => shortcutMatches(item.shortcut) && !item.disabled)
      if (command) { event.preventDefault(); command.run() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [context])
}
