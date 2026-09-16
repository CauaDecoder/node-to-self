import { describe, expect, it } from 'vitest'
import { createEmptyProject, parseProjectDocument } from './project'

const id = () => crypto.randomUUID()

describe('project document', () => {
  it('accepts an empty project and uses UUIDs with ISO dates', () => {
    const project = createEmptyProject({ name: 'A project' })
    expect(project.name).toBe('A project')
    expect(project.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(project.createdAt).toContain('T')
  })

  it('accepts every ticket-one entity', () => {
    const project = createEmptyProject()
    const typeId = id(); const groupId = id(); const nodeId = id(); const secondNodeId = id(); const connectionId = id()
    const complete = {
      ...project,
      nodeTypes: [{ id: typeId, name: 'Concept', color: '#777', icon: '◇', fields: [{ id: id(), name: 'URL', kind: 'url', required: false }] }],
      groups: [{ id: groupId, title: 'Area', color: '#777', position: { x: 0, y: 0 }, size: { width: 500, height: 300 } }],
      nodes: [nodeId, secondNodeId].map((nodeId, index) => ({ id: nodeId, typeId, title: 'Node', description: '', tags: [], properties: { count: index }, color: '#777', icon: '◇', position: { x: 10, y: 20 }, size: { width: 180, height: 80 }, parentGroupId: groupId })),
      connections: [{ id: connectionId, sourceNodeId: nodeId, targetNodeId: secondNodeId, label: '', relation: 'relates to', properties: {} }],
      notes: [{ id: id(), title: 'Decision', category: 'decision', markdown: 'Text', association: { kind: 'connection', id: connectionId } }],
      attachments: [{ id: id(), name: 'brief.pdf', mimeType: 'application/pdf', size: 42, associations: [{ kind: 'node', id: nodeId }], location: { kind: 'local', reference: 'attachment-key' } }],
    }
    expect(parseProjectDocument(complete).nodes).toHaveLength(2)
  })

  it('rejects duplicate IDs and missing references', () => {
    const project = createEmptyProject()
    expect(() => parseProjectDocument({ ...project, groups: [{ id: project.id, title: 'Bad', color: '#000', position: { x: 0, y: 0 }, size: { width: 1, height: 1 } }] })).toThrow('unique')
    expect(() => parseProjectDocument({ ...project, connections: [{ id: id(), sourceNodeId: id(), targetNodeId: id(), label: '', relation: 'links', properties: {} }] })).toThrow('Source node does not exist')
  })

  it('rejects a node with a missing type', () => {
    const project = createEmptyProject()
    expect(() => parseProjectDocument({
      ...project,
      nodes: [{ id: id(), typeId: id(), title: 'Untyped', description: '', tags: [], properties: {}, color: '#000', icon: '◇', position: { x: 0, y: 0 }, size: { width: 1, height: 1 } }],
    })).toThrow('Node type does not exist')
  })

  it('rejects a node with a missing parent group', () => {
    const project = createEmptyProject()
    const typeId = id()
    expect(() => parseProjectDocument({
      ...project,
      nodeTypes: [{ id: typeId, name: 'Concept', color: '#000', icon: '◇', fields: [] }],
      nodes: [{ id: id(), typeId, title: 'Orphan', description: '', tags: [], properties: {}, color: '#000', icon: '◇', position: { x: 0, y: 0 }, size: { width: 1, height: 1 }, parentGroupId: id() }],
    })).toThrow('Parent group does not exist')
  })

  it('rejects self-referential and indirect group cycles', () => {
    const project = createEmptyProject(); const first = id(); const second = id()
    const group = (groupId: string, parentGroupId?: string) => ({ id: groupId, title: 'Group', color: '#000', position: { x: 0, y: 0 }, size: { width: 1, height: 1 }, ...(parentGroupId === undefined ? {} : { parentGroupId }) })
    expect(() => parseProjectDocument({ ...project, groups: [group(first, first)] })).toThrow('cannot parent itself')
    expect(() => parseProjectDocument({ ...project, groups: [group(first, second), group(second, first)] })).toThrow('parent cycle')
  })
})
