import type { ReactFlowInstance } from '@xyflow/react'
import type { ConnectionEntity, GroupEntity, NodeEntity, NoteEntity } from '../domain/project'
import type { FlowEdge, FlowNode } from '../editor/adapter'
import { useEditorStore } from '../store/editor-store'
import { useProjectStore } from '../store/project-store'

export type Command = { id: string; title: string; shortcut?: string; disabled?: boolean; run: () => void }

export type CommandContext = {
  project: NonNullable<ReturnType<typeof useProjectStore.getState>['activeProject']>
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
  selection: SelectionEntities
}

export type SelectionEntities = {
  nodes: NodeEntity[]
  groups: GroupEntity[]
  connections: ConnectionEntity[]
  notes: NoteEntity[]
}

export function selectionEntities(project: CommandContext['project'], selectedIds: string[]): SelectionEntities {
  const selected = new Set(selectedIds)
  return {
    nodes: project.nodes.filter((node) => selected.has(node.id)),
    groups: project.groups.filter((group) => selected.has(group.id)),
    connections: project.connections.filter((edge) => selected.has(edge.id)),
    notes: project.notes.filter((note) => selected.has(note.id)),
  }
}

export function deleteSelection(ids: string[]): void {
  const state = useProjectStore.getState()
  const active = state.activeProject
  if (!active) return
  const selected = new Set(ids)
  const nodeIds = active.nodes.filter((node) => selected.has(node.id)).map((node) => node.id)
  const edgeIds = active.connections.filter((edge) => selected.has(edge.id)).map((edge) => edge.id)
  if (nodeIds.length) state.removeNodes(nodeIds)
  edgeIds.forEach((id) => state.disconnect(id))
  useEditorStore.getState().setSelectedIds([])
}

const hasSelectedNode = (context: CommandContext): boolean => context.selection.nodes.length > 0

export function buildCommands(context: CommandContext): Command[] {
  const { project, flowInstance } = context
  const hasSelection = context.selection.nodes.length + context.selection.groups.length + context.selection.connections.length + context.selection.notes.length > 0
  return [
    { id: 'node', title: 'Create node', shortcut: 'N', run: () => context.addNodeAtViewportCenter() },
    { id: 'child-node', title: 'Add child node', shortcut: 'Tab', disabled: !hasSelectedNode(context), run: context.addChildAndEditTitle },
    { id: 'sibling-node', title: 'Add sibling node', shortcut: 'Enter', disabled: !hasSelectedNode(context), run: context.addSiblingAndEditTitle },
    { id: 'note', title: 'Create visual note', run: () => useProjectStore.getState().addNote({ kind: 'project', id: project.id }) },
    { id: 'library-note', title: 'Create library note', run: context.addLibraryNote },
    { id: 'group', title: 'Group selection', shortcut: 'Ctrl/⌘+G', disabled: !hasSelection, run: () => useProjectStore.getState().createGroup(useEditorStore.getState().selectedIds) },
    { id: 'duplicate', title: 'Duplicate selection', shortcut: 'Ctrl/⌘+D', disabled: !hasSelection, run: () => useProjectStore.getState().duplicateSelection(useEditorStore.getState().selectedIds) },
    { id: 'delete', title: 'Delete selection', shortcut: 'Delete', disabled: !hasSelection, run: () => { const ids = useEditorStore.getState().selectedIds; if (ids.length) context.confirm({ title: 'Delete selection', confirmLabel: 'Delete', danger: true, onConfirm: () => deleteSelection(ids) }) } },
    { id: 'undo', title: 'Undo', shortcut: 'Ctrl/⌘+Z', disabled: useProjectStore.getState().history.length === 0, run: () => useProjectStore.getState().undo() },
    { id: 'redo', title: 'Redo', shortcut: 'Ctrl/⌘+Y', disabled: useProjectStore.getState().redoStack.length === 0, run: () => useProjectStore.getState().redo() },
    { id: 'rename', title: 'Rename node', shortcut: 'F2', disabled: !hasSelectedNode(context), run: () => { const node = context.selection.nodes[0]; if (node) context.beginTitleEdit(node.id) } },
    { id: 'details', title: 'Toggle details', shortcut: 'Ctrl/⌘+I', disabled: useEditorStore.getState().selectedIds.length !== 1, run: () => { const editor = useEditorStore.getState(); editor.setDetailsOpen(!editor.detailsOpen) } },
    { id: 'fit', title: 'Fit content', shortcut: 'F', run: () => void flowInstance?.fitView({ padding: 0.2 }) },
    { id: 'import', title: 'Import project', run: context.requestImport },
    { id: 'export', title: 'Export backup', run: context.exportBackup },
    { id: 'export-markdown', title: 'Export Markdown', run: context.exportMarkdown },
  ]
}
