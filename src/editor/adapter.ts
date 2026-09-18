import { MarkerType, type Edge, type Node } from '@xyflow/react'
import type { ConnectionEntity, GroupEntity, NodeEntity, NoteEntity, ProjectDocument } from '../domain/project'

export type CanvasNodeData = Pick<NodeEntity, 'title' | 'description' | 'tags' | 'color' | 'icon'> & { typeName: string }
export type CanvasGroupData = Pick<GroupEntity, 'title' | 'color'>
export type CanvasNoteData = Pick<NoteEntity, 'title' | 'markdown' | 'category'>
export type FlowNode = Node<CanvasNodeData, 'concept'> | Node<CanvasGroupData, 'group'> | Node<CanvasNoteData, 'note'>
export type FlowEdge = Edge<{ relation: string; properties: Record<string, unknown> }, 'labeled'>

function toNode(node: NodeEntity, typeName: string): Node<CanvasNodeData, 'concept'> {
  return {
    id: node.id,
    type: 'concept',
    position: node.position,
    width: node.size.width,
    height: node.size.height,
    parentId: node.parentGroupId,
    data: { title: node.title, color: node.color, icon: node.icon, description: node.description, tags: node.tags, typeName },
  }
}

function toGroup(group: GroupEntity): Node<CanvasGroupData, 'group'> {
  return {
    id: group.id,
    type: 'group',
    position: group.position,
    width: group.size.width,
    height: group.size.height,
    parentId: group.parentGroupId,
    data: { title: group.title, color: group.color },
    style: { borderColor: group.color, backgroundColor: `${group.color}16` },
  }
}

function toNote(note: NoteEntity): Node<CanvasNoteData, 'note'> | null {
  if (!note.position) return null
  return { id: note.id, type: 'note', position: note.position, ...(note.association.kind === 'group' ? { parentId: note.association.id } : {}), width: note.size?.width ?? 260, height: note.size?.height ?? 180, data: { title: note.title, markdown: note.markdown, category: note.category } }
}

function toEdge(connection: ConnectionEntity): FlowEdge {
  return {
    id: connection.id,
    type: 'labeled',
    source: connection.sourceNodeId,
    target: connection.targetNodeId,
    sourceHandle: connection.sourceHandle,
    targetHandle: connection.targetHandle,
    label: connection.label,
    markerEnd: { type: MarkerType.ArrowClosed },
    data: { relation: connection.relation, properties: connection.properties },
  }
}

export function documentToFlow(document: ProjectDocument): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const groups = new Map(document.groups.map((group) => [group.id, group]))
  const orderedGroups: Array<Node<CanvasGroupData, 'group'>> = []
  const visited = new Set<string>()
  const visit = (group: GroupEntity): void => {
    if (visited.has(group.id)) return
    visited.add(group.id)
    const parent = group.parentGroupId ? groups.get(group.parentGroupId) : undefined
    if (parent) visit(parent)
    orderedGroups.push(toGroup(group))
  }
  document.groups.forEach(visit)
  const typeNames = new Map(document.nodeTypes.map((type) => [type.id, type.name]))
  return { nodes: [...orderedGroups, ...document.nodes.map((node) => toNode(node, typeNames.get(node.typeId) ?? 'Concept')), ...document.notes.map(toNote).filter((note) => note !== null)], edges: document.connections.map(toEdge) }
}
