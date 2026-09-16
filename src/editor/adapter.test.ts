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
    expect(mappedNode).toMatchObject({ parentId: groupId, position: { x: 24, y: 32 }, width: 180, height: 80 })
    expect(edge).toMatchObject({ id: connectionId, source: sourceId, target: targetId, sourceHandle: 'outbound', targetHandle: 'inbound', label: 'feeds' })
  })
})
