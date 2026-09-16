import type { Edge, Node } from '@xyflow/react'
import type { ConnectionEntity, GroupEntity, NodeEntity, NoteEntity, ProjectDocument } from '../domain/project'

export type CanvasNodeData = { label: string; title: string; color: string; icon: string; description: string; onResize?: (id: string, size: { width: number; height: number }) => void }
export type CanvasGroupData = { label: string; title: string; color: string; onResize?: (id: string, size: { width: number; height: number }) => void }
export type CanvasNoteData = { label: string; title: string; markdown: string; category: string }

function toNode(node: NodeEntity, onResize?: CanvasNodeData['onResize']): Node<CanvasNodeData> {
  return {
    id: node.id,
    type: 'default',
    position: node.position,
    width: node.size.width,
    height: node.size.height,
    parentId: node.parentGroupId,
    data: { label: node.title, title: node.title, color: node.color, icon: node.icon, description: node.description, onResize },
  }
}

function toGroup(group: GroupEntity, onResize?: CanvasGroupData['onResize']): Node<CanvasGroupData> {
  return {
    id: group.id,
    type: 'editable-group',
    position: group.position,
    width: group.size.width,
    height: group.size.height,
    parentId: group.parentGroupId,
    data: { label: group.title, title: group.title, color: group.color, onResize },
    style: { borderColor: group.color, backgroundColor: `${group.color}16` },
  }
}

function toNote(note: NoteEntity): Node<CanvasNoteData> | null {
  if (!note.position) return null
  return { id: note.id, type: 'note', position: note.position, ...(note.association.kind === 'group' ? { parentId: note.association.id } : {}), width: 220, height: 120, data: { label: note.title, title: note.title, markdown: note.markdown, category: note.category } }
}

function toEdge(connection: ConnectionEntity): Edge {
  return {
    id: connection.id,
    source: connection.sourceNodeId,
    target: connection.targetNodeId,
    sourceHandle: connection.sourceHandle,
    targetHandle: connection.targetHandle,
    label: connection.label,
    data: { relation: connection.relation, properties: connection.properties },
  }
}

export function documentToFlow(document: ProjectDocument, options: { onResize?: CanvasNodeData['onResize']; onResizeGroup?: CanvasGroupData['onResize'] } = {}): { nodes: Array<Node<CanvasNodeData | CanvasGroupData | CanvasNoteData>>; edges: Edge[] } {
  return { nodes: [...document.groups.map((group) => toGroup(group, options.onResizeGroup)), ...document.nodes.map((node) => toNode(node, options.onResize)), ...document.notes.map(toNote).filter((note): note is Node<CanvasNoteData> => note !== null)], edges: document.connections.map(toEdge) }
}
