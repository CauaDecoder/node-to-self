import { describe, expect, it } from 'vitest'
import { createEmptyProject, parseProjectDocument } from '../domain/project'
import { documentToFlow } from './adapter'

describe('documentToFlow', () => {
  it('keeps document IDs and turns only nodes into edge endpoints', () => {
    const project = createEmptyProject()
    const output = documentToFlow(project)
    expect(output).toEqual({ nodes: [], edges: [] })
  })

  it('preserves group parenting, relative positions, dimensions, and connection details', () => {
    const project = createEmptyProject()
    const typeId = crypto.randomUUID()
    const groupId = crypto.randomUUID()
    const sourceId = crypto.randomUUID()
    const targetId = crypto.randomUUID()
    const connectionId = crypto.randomUUID()
    const document = parseProjectDocument({
      ...project,
      nodeTypes: [{ id: typeId, name: 'Concept', color: '#6b5ce7', icon: '◇', fields: [] }],
      groups: [{ id: groupId, title: 'Boundary', color: '#6b5ce7', position: { x: 80, y: 40 }, size: { width: 600, height: 400 } }],
      nodes: [
        { id: sourceId, typeId, title: 'Source', description: '', tags: [], properties: {}, color: '#6b5ce7', icon: '◇', position: { x: 24, y: 32 }, size: { width: 180, height: 80 }, parentGroupId: groupId },
        { id: targetId, typeId, title: 'Target', description: '', tags: [], properties: {}, color: '#6b5ce7', icon: '◇', position: { x: 300, y: 220 }, size: { width: 180, height: 80 } },
      ],
      connections: [{ id: connectionId, sourceNodeId: sourceId, targetNodeId: targetId, sourceHandle: 'outbound', targetHandle: 'inbound', label: 'feeds', relation: 'feeds', properties: {} }],
    })

    const flow = documentToFlow(document)
    const mappedGroup = flow.nodes.find((node) => node.id === groupId)
    const mappedNode = flow.nodes.find((node) => node.id === sourceId)
    const edge = flow.edges[0]
    if (mappedGroup === undefined || mappedNode === undefined || edge === undefined) throw new Error('Expected mapped flow entities.')

    expect(mappedGroup).toMatchObject({ position: { x: 80, y: 40 }, width: 600, height: 400 })
    expect(mappedNode).toMatchObject({ type: 'concept', data: { typeName: 'Concept' }, parentId: groupId, position: { x: 24, y: 32 }, width: 180, height: 80 })
    expect(edge).toMatchObject({ id: connectionId, source: sourceId, target: targetId, sourceHandle: 'outbound', targetHandle: 'inbound', label: 'feeds' })
    expect(edge.type).toBe('labeled')
    expect(edge.markerEnd).toMatchObject({ type: 'arrowclosed' })
  })

  it('emits concept nodes with the type name and labeled smoothstep edges', () => {
    const project = createEmptyProject()
    const typeId = crypto.randomUUID()
    const nodeId = crypto.randomUUID()
    const connectionId = crypto.randomUUID()
    const document = parseProjectDocument({
      ...project,
      nodeTypes: [{ id: typeId, name: 'Database', color: '#e3a968', icon: 'database', fields: [] }],
      nodes: [
        { id: nodeId, typeId, title: 'Primary', description: 'Stores rows', tags: ['core'], properties: {}, color: '#e3a968', icon: 'database', position: { x: 0, y: 0 }, size: { width: 200, height: 100 } },
      ],
      connections: [{ id: connectionId, sourceNodeId: nodeId, targetNodeId: nodeId, label: 'feeds', relation: 'feeds', properties: {} }],
    })
    const flow = documentToFlow(document)
    expect(flow.nodes).toHaveLength(1)
    const node = flow.nodes[0]
    if (node.type !== 'concept') throw new Error('Expected a concept node.')
    expect(node.type).toBe('concept')
    expect(node.data).toEqual({ title: 'Primary', description: 'Stores rows', tags: ['core'], color: '#e3a968', icon: 'database', typeName: 'Database' })
    expect(flow.edges[0].type).toBe('labeled')
  })

  it('maps library notes without positions to nothing and positioned notes to note nodes', () => {
    const project = createEmptyProject()
    const noteId = crypto.randomUUID()
    const document = parseProjectDocument({
      ...project,
      notes: [{ id: noteId, title: 'Decision log', category: 'decision', markdown: 'Why we chose Postgres', association: { kind: 'project', id: project.id }, position: { x: 30, y: 40 } }],
    })
    const flow = documentToFlow(document)
    expect(flow.nodes).toHaveLength(1)
    expect(flow.nodes[0]).toMatchObject({ id: noteId, type: 'note', position: { x: 30, y: 40 }, width: 260, height: 180 })
  })

  it('uses a note size when present instead of the default dimensions', () => {
    const project = createEmptyProject()
    const noteId = crypto.randomUUID()
    const document = parseProjectDocument({
      ...project,
      notes: [{ id: noteId, title: 'Sized note', category: 'general', markdown: '', association: { kind: 'project', id: project.id }, position: { x: 0, y: 0 }, size: { width: 320, height: 240 } }],
    })
    const flow = documentToFlow(document)
    expect(flow.nodes[0]).toMatchObject({ width: 320, height: 240 })
  })
})
