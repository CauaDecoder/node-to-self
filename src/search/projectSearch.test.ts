import { expect, it } from 'vitest'
import { createEmptyProject } from '../domain/project'
import { searchProject } from './projectSearch'

it('searches node type, tags, properties, and note markdown', () => {
  const project = createEmptyProject(); const typeId = crypto.randomUUID(); const nodeId = crypto.randomUUID(); const noteId = crypto.randomUUID()
  const document = { ...project, nodeTypes: [{ id: typeId, name: 'Database', color: '#777', icon: '◇', fields: [] }], nodes: [{ id: nodeId, typeId, title: 'Primary', description: '', tags: ['critical'], properties: { region: 'sa-east' }, color: '#777', icon: '◇', position: { x: 0, y: 0 }, size: { width: 100, height: 60 } }], notes: [{ id: noteId, title: 'Decision', category: 'decision' as const, markdown: 'Use encrypted backups', association: { kind: 'project' as const, id: project.id } }] }
  expect(searchProject(document, 'database')[0]).toMatchObject({ id: nodeId, kind: 'node' })
  expect(searchProject(document, 'critical')[0].id).toBe(nodeId)
  expect(searchProject(document, 'encrypted')[0]).toMatchObject({ id: noteId, kind: 'note' })
})
