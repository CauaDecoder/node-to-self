import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyProject, type ProjectDocument } from '../domain/project'
import { configureProjectDatabase, resetProjectStoreForTests, useProjectStore } from './project-store'

describe('project store', () => {
  beforeEach(() => {
    resetProjectStoreForTests()
    configureProjectDatabase({ projects: { put: async () => '' } } as never)
    useProjectStore.setState({ activeProject: createEmptyProject({ name: 'Test project' }) })
  })

  it('creates, connects, removes, and restores nodes as one document history', () => {
    const store = useProjectStore.getState()
    store.addNode({ x: 10, y: 20 }); store.addNode({ x: 300, y: 20 })
    const nodes = useProjectStore.getState().activeProject!.nodes
    store.connectNodes(nodes[0].id, nodes[1].id)
    expect(useProjectStore.getState().activeProject!.connections).toHaveLength(1)
    store.removeNodes([nodes[0].id])
    expect(useProjectStore.getState().activeProject!.connections).toHaveLength(0)
    store.undo()
    expect(useProjectStore.getState().activeProject!.connections).toHaveLength(1)
    expect(useProjectStore.getState().activeProject!.nodes).toHaveLength(2)
  })

  it('discards redo after a new edit and limits immutable history to 100 snapshots', () => {
    const store = useProjectStore.getState()
    for (let index = 0; index < 102; index += 1) store.addNode({ x: index, y: 0 })
    expect(useProjectStore.getState().history).toHaveLength(100)
    store.undo()
    store.addNode()
    expect(useProjectStore.getState().redoStack).toHaveLength(0)
  })

  it('exports a versioned document without editor state', () => {
    const json = useProjectStore.getState().exportProject()
    expect(json).toContain('"schemaVersion": 1')
    expect(json).not.toContain('history')
  })

  it('duplicates selected nodes with new IDs and only their internal connections', () => {
    const store = useProjectStore.getState()
    store.addNode({ x: 0, y: 0 }); store.addNode({ x: 200, y: 0 }); store.addNode({ x: 400, y: 0 })
    const [first, second, third] = useProjectStore.getState().activeProject!.nodes
    store.connectNodes(first.id, second.id); store.connectNodes(first.id, third.id)
    store.duplicateSelection([first.id, second.id])
    const result = useProjectStore.getState().activeProject!
    expect(result.nodes).toHaveLength(5)
    expect(result.connections).toHaveLength(3)
    const copies = result.nodes.slice(-2)
    expect(copies.map((node) => node.id)).not.toContain(first.id)
    expect(copies[0].position).toEqual({ x: 40, y: 40 })
    expect(result.connections.at(-1)).toMatchObject({ sourceNodeId: copies[0].id, targetNodeId: copies[1].id })
  })

  it('keeps clipboard available across projects and remaps conflicting node types', () => {
    const store = useProjectStore.getState(); store.addNode()
    const source = useProjectStore.getState().activeProject!; const sourceNode = source.nodes[0]
    store.copySelection([sourceNode.id])
    const destination = createEmptyProject({ name: 'Destination' })
    const conflicting = { ...source.nodeTypes[0], name: 'Different concept' }
    useProjectStore.setState({ activeProject: { ...destination, nodeTypes: [conflicting] }, history: [], redoStack: [] })
    store.pasteClipboard()
    const pasted = useProjectStore.getState().activeProject!
    expect(pasted.nodeTypes).toHaveLength(2)
    expect(pasted.nodes[0].typeId).not.toBe(conflicting.id)
  })

  it('groups, ungroups, and rejects circular parents without moving content on screen', () => {
    const store = useProjectStore.getState(); store.addNode({ x: 120, y: 90 })
    const node = useProjectStore.getState().activeProject!.nodes[0]
    store.createGroup([node.id])
    const first = useProjectStore.getState().activeProject!.groups[0]
    store.createGroup([first.id])
    const second = useProjectStore.getState().activeProject!.groups.find((group) => group.id !== first.id)!
    expect(useProjectStore.getState().activeProject!.nodes[0].position).toEqual({ x: 40, y: 40 })
    store.changeGroupParent(second.id, first.id)
    expect(useProjectStore.getState().activeProject!.groups.find((group) => group.id === second.id)!.parentGroupId).toBeUndefined()
    store.ungroup(first.id)
    const result = useProjectStore.getState().activeProject!
    expect(result.groups).toHaveLength(1)
    expect(result.nodes[0].parentGroupId).toBe(second.id)
  })

  it('copies nested groups and deletes a hierarchy with its dependent connections', () => {
    const store = useProjectStore.getState(); store.addNode({ x: 0, y: 0 }); store.addNode({ x: 220, y: 0 })
    const [firstNode, secondNode] = useProjectStore.getState().activeProject!.nodes
    store.connectNodes(firstNode.id, secondNode.id); store.createGroup([firstNode.id, secondNode.id])
    const group = useProjectStore.getState().activeProject!.groups[0]
    store.duplicateSelection([group.id])
    expect(useProjectStore.getState().activeProject!.groups).toHaveLength(2)
    store.deleteGroup(group.id, true)
    expect(useProjectStore.getState().activeProject!.connections).toHaveLength(1)
    store.undo()
    expect(useProjectStore.getState().activeProject!.connections).toHaveLength(2)
  })

  it('imports only validated JSON as a distinct project with remapped IDs', async () => {
    const source = useProjectStore.getState().activeProject!
    const persisted: ProjectDocument[] = []
    configureProjectDatabase({ projects: { put: async (project: ProjectDocument) => { persisted.push(project); return project.id } } } as never)
    await useProjectStore.getState().importProject(JSON.stringify(source))
    const imported = useProjectStore.getState().activeProject!
    expect(imported.id).not.toBe(source.id)
    expect(imported.name).toBe('Imported: Test project')
    expect(persisted).toHaveLength(1)
    await expect(useProjectStore.getState().importProject(JSON.stringify({ ...source, schemaVersion: 2 }))).rejects.toThrow('newer version')
    expect(useProjectStore.getState().projects).toHaveLength(1)
  })

  it('duplicates a complete project as an independent document', async () => {
    const store = useProjectStore.getState()
    store.addNode({ x: 10, y: 20 }); store.addNote({ kind: 'project', id: useProjectStore.getState().activeProject!.id }, { x: 40, y: 50 })
    const source = useProjectStore.getState().activeProject!
    configureProjectDatabase({ projects: { get: async () => source, put: async (project: ProjectDocument) => project.id } } as never)
    await store.duplicateProject()
    const duplicate = useProjectStore.getState().activeProject!
    expect(duplicate.id).not.toBe(source.id)
    expect(duplicate.canvas.id).not.toBe(source.canvas.id)
    expect(duplicate.nodes).toHaveLength(source.nodes.length)
    expect(duplicate.notes).toHaveLength(source.notes.length)
    expect(duplicate.nodes[0].id).not.toBe(source.nodes[0].id)
    expect(duplicate.notes[0].association).toEqual({ kind: 'project', id: duplicate.id })
  })

  it('keeps notes when their associated node is removed and restores association through undo', () => {
    const store = useProjectStore.getState(); store.addNode(); const node = useProjectStore.getState().activeProject!.nodes[0]
    store.addNote({ kind: 'node', id: node.id }, { x: 30, y: 40 })
    const note = useProjectStore.getState().activeProject!.notes[0]
    store.removeNodes([node.id])
    expect(useProjectStore.getState().activeProject!.notes[0].association).toEqual({ kind: 'project', id: useProjectStore.getState().activeProject!.id })
    store.undo()
    expect(useProjectStore.getState().activeProject!.notes[0]).toMatchObject({ id: note.id, association: { kind: 'node', id: node.id } })
  })

  it('prevents removing a node type in use and rejects incompatible required fields', () => {
    const store = useProjectStore.getState(); store.addNode(); const project = useProjectStore.getState().activeProject!; const type = project.nodeTypes[0]
    expect(store.removeNodeType(type.id)).toBe(false)
    expect(store.updateNodeType(type.id, { fields: [{ id: crypto.randomUUID(), name: 'Required', kind: 'text', required: true }] })).toBe(false)
    expect(useProjectStore.getState().activeProject!.nodeTypes[0].fields).toHaveLength(0)
  })

  it('serializes saves and keeps newer in-memory revisions from being overwritten', async () => {
    const writes: ProjectDocument[] = []
    let releaseFirst: (() => void) | undefined
    let signalFirstStarted: (() => void) | undefined
    const firstStartedPromise = new Promise<void>((resolve) => { signalFirstStarted = resolve })
    let firstStarted = false
    configureProjectDatabase({ projects: {
      get: async () => undefined,
      put: async (project: ProjectDocument) => {
        if (!firstStarted) { firstStarted = true; signalFirstStarted?.(); await new Promise<void>((resolve) => { releaseFirst = resolve }) }
        writes.push(project)
        return project.id
      },
    } } as never)
    const store = useProjectStore.getState()
    store.addNode()
    const firstSave = store.saveNow()
    store.addNode()
    const secondSave = store.saveNow()
    await firstStartedPromise
    releaseFirst?.()
    await Promise.all([firstSave, secondSave])
    expect(writes.map((project) => project.revision)).toEqual([1, 2])
    expect(writes.at(-1)?.nodes).toHaveLength(2)
  })

  it('detects a same-revision edit from another tab without replacing local memory', async () => {
    const localStore = useProjectStore.getState()
    localStore.addNode()
    const local = useProjectStore.getState().activeProject!
    const external = { ...local, name: 'Edited in another tab', updatedAt: new Date(Date.now() + 1000).toISOString() }
    configureProjectDatabase({ projects: { get: async () => external, put: async () => external.id } } as never)
    await localStore.saveNow()
    expect(useProjectStore.getState().saveStatus).toBe('conflict')
    expect(useProjectStore.getState().activeProject?.name).toBe('Test project')
    expect(useProjectStore.getState().conflictProject?.name).toBe('Edited in another tab')
  })

  it('does not switch projects when the pending autosave fails', async () => {
    const source = useProjectStore.getState().activeProject!
    const destination = createEmptyProject({ name: 'Destination' })
    configureProjectDatabase({ projects: {
      get: async (id: string) => id === destination.id ? destination : undefined,
      put: async () => { throw new Error('Storage unavailable') },
    } } as never)
    const store = useProjectStore.getState()
    store.addNode()
    await store.openProject(destination.id)
    expect(useProjectStore.getState().activeProject?.id).toBe(source.id)
    expect(useProjectStore.getState().saveStatus).toBe('error')
    expect(useProjectStore.getState().activeProject?.nodes).toHaveLength(1)
  })

  it('creates a child with its connection in a single undo step', () => {
    const store = useProjectStore.getState()
    store.addNode({ x: 100, y: 100 })
    const parent = useProjectStore.getState().activeProject!.nodes[0]
    const childId = store.addChildNode(parent.id, 'child')
    expect(childId).toBeDefined()
    const afterAdd = useProjectStore.getState().activeProject!
    expect(afterAdd.nodes).toHaveLength(2)
    expect(afterAdd.connections).toHaveLength(1)
    expect(afterAdd.connections[0]).toMatchObject({ sourceNodeId: parent.id, targetNodeId: childId })
    store.undo()
    const undone = useProjectStore.getState().activeProject!
    expect(undone.nodes).toHaveLength(1)
    expect(undone.connections).toHaveLength(0)
    store.redo()
    expect(useProjectStore.getState().activeProject!.connections).toHaveLength(1)
  })

  it('creates a sibling below with the same type and group as its parent', () => {
    const store = useProjectStore.getState()
    store.addNode({ x: 100, y: 100 })
    const parent = useProjectStore.getState().activeProject!.nodes[0]
    const childId = store.addChildNode(parent.id, 'child')
    const child = useProjectStore.getState().activeProject!.nodes.find((node) => node.id === childId)!
    const siblingId = store.addChildNode(child.id, 'sibling')
    const sibling = useProjectStore.getState().activeProject!.nodes.find((node) => node.id === siblingId)!
    expect(sibling.typeId).toBe(child.typeId)
    expect(sibling.position.y).toBeGreaterThan(child.position.y)
    expect(sibling.parentGroupId).toBe(child.parentGroupId)
    const incoming = useProjectStore.getState().activeProject!.connections.find((edge) => edge.targetNodeId === siblingId)
    expect(incoming?.sourceNodeId).toBe(parent.id)
  })

  it('applies the chosen type color and icon when adding a node', () => {
    const store = useProjectStore.getState()
    useProjectStore.setState({ activeProject: { ...createEmptyProject({ name: 'Typed' }), nodeTypes: [{ id: crypto.randomUUID(), name: 'Database', color: '#e3a968', icon: 'database', fields: [] }] } })
    const typeId = useProjectStore.getState().activeProject!.nodeTypes[0].id
    store.addNode({ x: 0, y: 0 }, typeId)
    const node = useProjectStore.getState().activeProject!.nodes[0]
    expect(node.title).toBe('New Database')
    expect(node.color).toBe('#e3a968')
    expect(node.icon).toBe('database')
  })

  it('renames a group through updateGroup', () => {
    const store = useProjectStore.getState()
    store.addNode({ x: 0, y: 0 })
    const node = useProjectStore.getState().activeProject!.nodes[0]
    store.createGroup([node.id])
    const group = useProjectStore.getState().activeProject!.groups[0]
    store.updateGroup(group.id, { title: 'Boundary', color: '#62c6a4' })
    const updated = useProjectStore.getState().activeProject!.groups.find((item) => item.id === group.id)
    expect(updated).toMatchObject({ title: 'Boundary', color: '#62c6a4' })
  })

  it('persists visual note positions through moveElements', () => {
    const store = useProjectStore.getState()
    store.addNote({ kind: 'project', id: useProjectStore.getState().activeProject!.id }, { x: 40, y: 50 })
    const note = useProjectStore.getState().activeProject!.notes[0]
    expect(note.position).toEqual({ x: 40, y: 50 })
    store.moveElements({ [note.id]: { x: 220, y: 130 } })
    const moved = useProjectStore.getState().activeProject!.notes[0]
    expect(moved.position).toEqual({ x: 220, y: 130 })
    store.undo()
    expect(useProjectStore.getState().activeProject!.notes[0].position).toEqual({ x: 40, y: 50 })
  })

  it('resizes a note as a single undo step', () => {
    const store = useProjectStore.getState()
    store.addNote({ kind: 'project', id: useProjectStore.getState().activeProject!.id }, { x: 40, y: 50 })
    const note = useProjectStore.getState().activeProject!.notes[0]
    const historyBefore = useProjectStore.getState().history.length
    store.resizeNote(note.id, { width: 320, height: 220 }, { x: 60, y: 70 })
    const resized = useProjectStore.getState().activeProject!.notes[0]
    expect(resized.size).toEqual({ width: 320, height: 220 })
    expect(resized.position).toEqual({ x: 60, y: 70 })
    expect(useProjectStore.getState().history.length).toBe(historyBefore + 1)
    store.undo()
    expect(useProjectStore.getState().activeProject!.notes[0].size).toBeUndefined()
  })
})
