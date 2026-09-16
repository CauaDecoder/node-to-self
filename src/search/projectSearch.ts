import type { ProjectDocument } from '../domain/project'

export type SearchResult = { id: string; kind: 'node' | 'connection' | 'group' | 'note' | 'type'; title: string; context: string }
const text = (value: unknown) => JSON.stringify(value).toLocaleLowerCase()

export function searchProject(project: ProjectDocument, query: string): SearchResult[] {
  const term = query.trim().toLocaleLowerCase()
  if (!term) return []
  const matches = (value: unknown) => text(value).includes(term)
  return [
    ...project.nodes.filter((node) => matches([node.title, node.description, node.tags, node.properties, project.nodeTypes.find((type) => type.id === node.typeId)?.name])).map((node) => ({ id: node.id, kind: 'node' as const, title: node.title, context: project.nodeTypes.find((type) => type.id === node.typeId)?.name ?? 'Node' })),
    ...project.connections.filter((connection) => matches([connection.label, connection.relation, connection.properties])).map((connection) => ({ id: connection.id, kind: 'connection' as const, title: connection.label || connection.relation, context: `Connection: ${connection.relation}` })),
    ...project.groups.filter((group) => matches(group.title)).map((group) => ({ id: group.id, kind: 'group' as const, title: group.title, context: 'Group' })),
    ...project.notes.filter((note) => matches([note.title, note.category, note.markdown])).map((note) => ({ id: note.id, kind: 'note' as const, title: note.title, context: note.position ? `Visual note · ${note.category}` : `Library note · ${note.category}` })),
    ...project.nodeTypes.filter((type) => matches(type.name)).map((type) => ({ id: type.id, kind: 'type' as const, title: type.name, context: 'Node type' })),
  ]
}
