import { NodeToolbar, Position } from '@xyflow/react'
import { Copy, Group, Info, Pencil, Trash2 } from 'lucide-react'
import type { NoteEntity, ProjectDocument } from '../../domain/project'
import type { SelectionEntities } from '../actions'
import { useEditorStore } from '../../store/editor-store'
import { useProjectStore } from '../../store/project-store'

type SelectionToolbarProps = {
  project: ProjectDocument
  selection: SelectionEntities
  confirm: (options: { title: string; description?: string; confirmLabel: string; danger?: boolean; onConfirm: () => void }) => void
  beginTitleEdit: (nodeId: string) => void
  openDetails: () => void
}

const typeColors = ['#7c6cff', '#5c9cff', '#62c6a4', '#e3a968', '#e580a1', '#d5b86a', '#6dc6d7', '#b897e7', '#8793a8']

export function SelectionToolbar({ project, selection, confirm, beginTitleEdit, openDetails }: SelectionToolbarProps): React.JSX.Element | null {
  const single = selection.nodes.length === 1 && !selection.groups.length && !selection.connections.length && !selection.notes.length
    ? project.nodes.find((node) => node.id === selection.nodes[0].id)
    : undefined
  const singleGroup = selection.groups.length === 1 && !selection.nodes.length && !selection.connections.length && !selection.notes.length
    ? project.groups.find((group) => group.id === selection.groups[0].id)
    : undefined
  const singleNote = selection.notes.length === 1 && !selection.nodes.length && !selection.groups.length && !selection.connections.length
    ? project.notes.find((note) => note.id === selection.notes[0].id)
    : undefined
  const singleConnection = selection.connections.length === 1 && !selection.nodes.length && !selection.groups.length && !selection.notes.length
    ? project.connections.find((edge) => edge.id === selection.connections[0].id)
    : undefined
  if (!single && !singleGroup && !singleNote && !singleConnection) return null
  const updateNode = useProjectStore.getState().updateNode
  const removeSelection = (ids: string[], description: string) => confirm({ title: 'Delete selection', description, confirmLabel: 'Delete', danger: true, onConfirm: () => useProjectStore.getState().deleteSelection(ids) })
  const nodeId = single ? single.id : singleGroup ? singleGroup.id : singleNote ? singleNote.id : singleConnection ? [singleConnection.sourceNodeId, singleConnection.targetNodeId] : selection.nodes.length ? selection.nodes.map((node) => node.id) : undefined
  return (
    <NodeToolbar nodeId={nodeId} isVisible position={Position.Top} className="selection-toolbar">
      {single && (
        <>
          <span className="toolbar-cluster" role="group" aria-label="Node color">
            {typeColors.map((color) => (
              <button key={color} type="button" className="swatch" style={{ background: color }} aria-label={`Set node color ${color}`} aria-pressed={single.color === color} onClick={() => updateNode(single.id, { color })} />
            ))}
          </span>
          <select aria-label="Change node type" value={single.typeId} onChange={(event) => useProjectStore.getState().updateNode(single.id, { typeId: event.target.value })}>
            {project.nodeTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
          </select>
          <button type="button" aria-label="Add child node" onClick={() => { const id = useProjectStore.getState().addChildNode(single.id, 'child'); if (id) beginTitleEdit(id) }}><PlusGlyph /> Add child</button>
          <button type="button" aria-label="Add note to node" onClick={() => useProjectStore.getState().addNote({ kind: 'node', id: single.id })}><PlusGlyph /> Add note</button>
          <button type="button" aria-label="Group this node" onClick={() => useProjectStore.getState().createGroup([single.id])}><Group size={13} aria-hidden="true" /> Group</button>
          <button type="button" aria-label="Open details" onClick={openDetails}><Info size={13} aria-hidden="true" /> Details</button>
          <button type="button" aria-label="Rename node" onClick={() => beginTitleEdit(single.id)}><Pencil size={13} aria-hidden="true" /></button>
          <button type="button" className="danger" aria-label="Delete node" onClick={() => removeSelection([single.id], `Delete "${single.title}"? This cannot be undone.`)}><Trash2 size={13} aria-hidden="true" /></button>
        </>
      )}
      {singleGroup && (
        <>
          <input aria-label="Group title" defaultValue={singleGroup.title} onBlur={(event) => useProjectStore.getState().updateGroup(singleGroup.id, { title: event.target.value || 'New group' })} />
          <span className="toolbar-cluster" role="group" aria-label="Group color">
            {typeColors.map((color) => (
              <button key={color} type="button" className="swatch" style={{ color }} aria-label={`Set group color ${color}`} aria-pressed={singleGroup.color === color} onClick={() => useProjectStore.getState().updateGroup(singleGroup.id, { color })}><SwatchDot color={color} /></button>
            ))}
          </span>
          <select aria-label="Change group parent" value={singleGroup.parentGroupId ?? ''} onChange={(event) => useProjectStore.getState().changeGroupParent(singleGroup.id, event.target.value || undefined)}>
            <option value="">Canvas</option>
            {project.groups.filter((group) => group.id !== singleGroup.id).map((group) => <option key={group.id} value={group.id}>{group.title}</option>)}
          </select>
          <button type="button" aria-label="Ungroup" onClick={() => useProjectStore.getState().ungroup(singleGroup.id)}>Ungroup</button>
          <button type="button" aria-label="Open details" onClick={openDetails}><Info size={13} aria-hidden="true" /> Details</button>
          <button type="button" className="danger" aria-label="Delete group with descendants" onClick={() => confirm({ title: 'Delete group', description: `Delete "${singleGroup.title}" and every descendant? This cannot be undone.`, confirmLabel: 'Delete group', danger: true, onConfirm: () => useProjectStore.getState().deleteGroup(singleGroup.id, true) })}><Trash2 size={13} aria-hidden="true" /></button>
        </>
      )}
      {singleNote && (
        <>
          <select aria-label="Note category" value={singleNote.category} onChange={(event) => useProjectStore.getState().updateNote(singleNote.id, { category: event.target.value as NoteEntity['category'] })}>
            {(['general', 'decision', 'requirement', 'documentation', 'prompt'] as const).map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <button type="button" aria-label="Open details" onClick={openDetails}><Info size={13} aria-hidden="true" /> Details</button>
          <button type="button" className="danger" aria-label="Delete note" onClick={() => confirm({ title: 'Delete note', description: `Delete "${singleNote.title}"? This cannot be undone.`, confirmLabel: 'Delete', danger: true, onConfirm: () => useProjectStore.getState().deleteNote(singleNote.id) })}><Trash2 size={13} aria-hidden="true" /></button>
        </>
      )}
      {singleConnection && (
        <>
          <input aria-label="Connection label" defaultValue={singleConnection.label} placeholder="Label" onBlur={(event) => useProjectStore.getState().updateConnection(singleConnection.id, { label: event.target.value })} />
          <input aria-label="Connection relation" defaultValue={singleConnection.relation} placeholder="Relation" onBlur={(event) => useProjectStore.getState().updateConnection(singleConnection.id, { relation: event.target.value || 'connects to' })} />
          <button type="button" aria-label="Open details" onClick={openDetails}><Info size={13} aria-hidden="true" /> Details</button>
          <button type="button" className="danger" aria-label="Delete connection" onClick={() => useProjectStore.getState().disconnect(singleConnection.id)}><Trash2 size={13} aria-hidden="true" /></button>
        </>
      )}
      {!single && !singleGroup && !singleNote && !singleConnection && (
        <>
          <button type="button" aria-label="Group selection" onClick={() => useProjectStore.getState().createGroup(useEditorStore.getState().selectedIds)}><Group size={13} aria-hidden="true" /> Group</button>
          <button type="button" aria-label="Duplicate selection" onClick={() => useProjectStore.getState().duplicateSelection(useEditorStore.getState().selectedIds)}><Copy size={13} aria-hidden="true" /> Duplicate</button>
          <button type="button" className="danger" aria-label="Delete selection" onClick={() => removeSelection(useEditorStore.getState().selectedIds, `Delete ${useEditorStore.getState().selectedIds.length} items? This cannot be undone.`)}><Trash2 size={13} aria-hidden="true" /> Delete</button>
        </>
      )}
    </NodeToolbar>
  )
}

function PlusGlyph(): React.JSX.Element {
  return <span aria-hidden="true">＋</span>
}

function SwatchDot({ color }: { color: string }): React.JSX.Element {
  return <span className="swatch-dot" style={{ background: color }} aria-hidden="true" />
}
