import { create } from 'zustand'
import { absolutePosition, descendantGroupIds, groupBounds, relativePosition } from '../domain/groups'
import { parseProjectDocument, type ConnectionEntity, type GroupEntity, type NodeEntity, type NoteEntity, type ProjectDocument } from '../domain/project'
import { createProjectDatabase, type ProjectDatabase } from '../storage/database'
import { addAttachment, exportBackup as exportProjectBackup, parseBackup } from '../storage/attachments'
import { createProjectFromTemplate, type ProjectTemplateId } from '../templates/projectTemplates'

export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error' | 'conflict'
export type ProjectSummary = Pick<ProjectDocument, 'id' | 'name' | 'updatedAt'>

const HISTORY_LIMIT = 100
let database: ProjectDatabase = createProjectDatabase()
let saveTimer: ReturnType<typeof setTimeout> | undefined
let saveChain: Promise<void> = Promise.resolve()
type Clipboard = { nodes: NodeEntity[]; groups: GroupEntity[]; notes: NoteEntity[]; connections: ConnectionEntity[]; nodeTypes: ProjectDocument['nodeTypes'] }
let clipboard: Clipboard | null = null

const copy = <T,>(value: T): T => structuredClone(value)
const timestamp = () => new Date().toISOString()
const summary = (project: ProjectDocument): ProjectSummary => ({ id: project.id, name: project.name, updatedAt: project.updatedAt })
function withParent<T extends NodeEntity | GroupEntity>(item: T, parentGroupId: string | undefined, position: { x: number; y: number }): T {
  const { parentGroupId: _oldParentId, ...withoutParent } = item
  return { ...withoutParent, position, ...(parentGroupId ? { parentGroupId } : {}) } as T
}

function defaultType(project: ProjectDocument): { project: ProjectDocument; type: ProjectDocument['nodeTypes'][number] } {
  if (project.nodeTypes[0] !== undefined) return { project, type: project.nodeTypes[0] }
  const type: ProjectDocument['nodeTypes'][number] = { id: crypto.randomUUID(), name: 'Concept', color: '#7c6cff', icon: 'diamond', fields: [] }
  return { project: { ...project, nodeTypes: [type] }, type }
}

function newNode(type: ProjectDocument['nodeTypes'][number], position: NodeEntity['position']): NodeEntity {
  const properties = Object.fromEntries(type.fields.filter((field) => field.defaultValue !== undefined).map((field) => [field.id, copy(field.defaultValue)]))
  return { id: crypto.randomUUID(), typeId: type.id, title: `New ${type.name}`, description: '', tags: [], properties, color: type.color, icon: type.icon, position, size: { width: 260, height: 180 } }
}

type RemappedProject = { project: ProjectDocument; ids: Map<string, string> }

function remapImportedProject(source: ProjectDocument): RemappedProject {
  const ids = new Map<string, string>()
  const map = (id: string) => ids.get(id) ?? (ids.set(id, crypto.randomUUID()), ids.get(id)!)
  map(source.id); map(source.canvas.id)
  source.nodeTypes.forEach((type) => { map(type.id); type.fields.forEach((field) => map(field.id)) })
  source.nodes.forEach((node) => map(node.id)); source.connections.forEach((connection) => map(connection.id))
  source.groups.forEach((group) => map(group.id)); source.notes.forEach((note) => map(note.id)); source.attachments.forEach((attachment) => map(attachment.id))
  const association = (item: { kind: 'project' | 'canvas' | 'node' | 'connection' | 'group'; id: string }) => ({ ...item, id: map(item.id) })
  const now = timestamp()
  return { project: parseProjectDocument({
    ...source, id: map(source.id), name: `Imported: ${source.name}`, createdAt: now, updatedAt: now,
    revision: 0,
    canvas: { ...source.canvas, id: map(source.canvas.id) },
    nodeTypes: source.nodeTypes.map((type) => ({ ...type, id: map(type.id), fields: type.fields.map((field) => ({ ...field, id: map(field.id) })) })),
    nodes: source.nodes.map((node) => ({ ...node, id: map(node.id), typeId: map(node.typeId), ...(node.parentGroupId ? { parentGroupId: map(node.parentGroupId) } : {}) })),
    connections: source.connections.map((connection) => ({ ...connection, id: map(connection.id), sourceNodeId: map(connection.sourceNodeId), targetNodeId: map(connection.targetNodeId) })),
    groups: source.groups.map((group) => ({ ...group, id: map(group.id), ...(group.parentGroupId ? { parentGroupId: map(group.parentGroupId) } : {}) })),
    notes: source.notes.map((note) => ({ ...note, id: map(note.id), association: association(note.association) })),
    attachments: source.attachments.map((attachment) => ({ ...attachment, id: map(attachment.id), associations: attachment.associations.map(association) })),
  }), ids }
}

function typeSignature(type: ProjectDocument['nodeTypes'][number]): string {
  return JSON.stringify({ name: type.name, color: type.color, icon: type.icon, fields: type.fields.map(({ id: _id, ...field }) => field) })
}

class SaveConflictError extends Error {
  constructor() { super('This project changed in another tab. Your changes were kept in memory.'); this.name = 'SaveConflictError' }
}

const hasProjectRead = (value: ProjectDatabase): value is ProjectDatabase & { projects: ProjectDatabase['projects'] } => typeof value.projects.get === 'function'
const hasAttachments = (value: ProjectDatabase): value is ProjectDatabase & { attachments: ProjectDatabase['attachments'] } => Boolean(value.attachments && typeof value.attachments.where === 'function')
const readStoredProject = async (id: string): Promise<ProjectDocument | undefined> => hasProjectRead(database) ? await database.projects.get(id) : undefined

function documentsMatch(left: ProjectDocument, right: ProjectDocument): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

async function waitForSaveBeforeSwitch(): Promise<boolean> {
  const state = useProjectStore.getState()
  if (!state.activeProject || !['pending', 'saving', 'error', 'conflict'].includes(state.saveStatus)) return true
  await state.saveNow()
  return useProjectStore.getState().saveStatus === 'saved'
}

type ProjectState = {
  projects: ProjectSummary[]
  activeProject: ProjectDocument | null
  history: ProjectDocument[]
  redoStack: ProjectDocument[]
  saveStatus: SaveStatus
  saveError: string | null
  conflictProject: ProjectDocument | null
  initialize: () => Promise<void>
  createProject: (name: string, templateId?: ProjectTemplateId) => Promise<void>
  openProject: (id: string) => Promise<void>
  closeProject: () => Promise<void>
  deleteProject: (id: string) => Promise<void>
  duplicateProject: (id?: string) => Promise<void>
  applyDocument: (next: ProjectDocument, recordHistory?: boolean) => void
  renameProject: (name: string) => void
  addNode: (position?: NodeEntity['position'], typeId?: string) => string | undefined
  addChildNode: (parentId: string, placement: 'child' | 'sibling') => string | undefined
  moveNodes: (positions: Record<string, { x: number; y: number }>) => void
  moveElements: (positions: Record<string, { x: number; y: number }>) => void
  createGroup: (ids: string[]) => void
  changeGroupParent: (groupId: string, parentGroupId?: string) => void
  ungroup: (groupId: string) => void
  deleteGroup: (groupId: string, descendants?: boolean) => void
  resizeGroup: (groupId: string, size: GroupEntity['size'], position?: GroupEntity['position']) => void
  updateGroup: (id: string, patch: Partial<Pick<GroupEntity, 'title' | 'color'>>) => void
  updateNode: (id: string, patch: Partial<Omit<NodeEntity, 'id' | 'parentGroupId'>>) => void
  updateConnection: (id: string, patch: Partial<Pick<ConnectionEntity, 'label' | 'relation' | 'properties'>>) => void
  addNote: (association?: NoteEntity['association'], position?: { x: number; y: number }) => void
  updateNote: (id: string, patch: Partial<Omit<NoteEntity, 'id'>>) => void
  resizeNote: (id: string, size: { width: number; height: number }, position?: { x: number; y: number }) => void
  deleteNote: (id: string) => void
  addNodeType: (name: string, color?: string, icon?: string) => void
  updateNodeType: (id: string, patch: Partial<Omit<ProjectDocument['nodeTypes'][number], 'id'>>) => boolean
  removeNodeType: (id: string) => boolean
  copySelection: (ids: string[]) => void
  pasteClipboard: () => void
  duplicateSelection: (ids: string[]) => void
  removeNodes: (ids: string[]) => void
  deleteSelection: (ids: string[]) => void
  connectNodes: (sourceNodeId: string, targetNodeId: string, sourceHandle?: string | null, targetHandle?: string | null) => void
  disconnect: (id: string) => void
  undo: () => void
  redo: () => void
  saveNow: () => Promise<void>
  retrySave: () => Promise<void>
  reloadSavedProject: () => Promise<void>
  exportProject: () => string | null
  exportBackup: () => Promise<string | null>
  importProject: (json: string) => Promise<void>
  addAttachmentFile: (file: File, associations: ProjectDocument['attachments'][number]['associations']) => Promise<void>
  removeAttachment: (attachmentId: string) => void
}

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => void useProjectStore.getState().saveNow(), 500)
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [], activeProject: null, history: [], redoStack: [], saveStatus: 'saved', saveError: null, conflictProject: null,
  initialize: async () => {
    const projects = await database.projects.orderBy('updatedAt').reverse().toArray()
    set({ projects: projects.map(summary) })
    if (projects[0]) await get().openProject(projects[0].id)
  },
  createProject: async (name, templateId = 'blank') => {
    if (!(await waitForSaveBeforeSwitch())) return
    const project = createProjectFromTemplate(templateId, name.trim() || 'Untitled project')
    await database.projects.put(project)
    set((state) => ({ projects: [summary(project), ...state.projects.filter((item) => item.id !== project.id)], activeProject: project, history: [], redoStack: [], saveStatus: 'saved', saveError: null, conflictProject: null }))
  },
  openProject: async (id) => {
    if (get().activeProject?.id === id) return
    if (!(await waitForSaveBeforeSwitch())) return
    const project = await readStoredProject(id)
    if (!project) return
    if (saveTimer) clearTimeout(saveTimer)
    set({ activeProject: parseProjectDocument(project), history: [], redoStack: [], saveStatus: 'saved', saveError: null, conflictProject: null })
  },
  closeProject: async () => {
    if (!(await waitForSaveBeforeSwitch())) return
    if (saveTimer) clearTimeout(saveTimer)
    set({ activeProject: null, history: [], redoStack: [], saveStatus: 'saved', saveError: null, conflictProject: null })
  },
  deleteProject: async (id) => {
    if (get().activeProject?.id === id && !(await waitForSaveBeforeSwitch())) return
    await database.projects.delete(id)
    const wasActive = get().activeProject?.id === id
    set((state) => ({ projects: state.projects.filter((project) => project.id !== id), ...(wasActive ? { activeProject: null, history: [], redoStack: [], saveStatus: 'saved' as const, saveError: null, conflictProject: null } : {}) }))
  },
  duplicateProject: async (id) => {
    const sourceId = id ?? get().activeProject?.id
    if (!sourceId) return
    if (get().activeProject?.id === sourceId && !(await waitForSaveBeforeSwitch())) return
    const stored = await readStoredProject(sourceId)
    const source = stored ? parseProjectDocument(stored) : get().activeProject?.id === sourceId ? get().activeProject : null
    if (!source) return
    const remapped = remapImportedProject(source)
    const sourceFiles = hasAttachments(database) ? await database.attachments.where('projectId').equals(source.id).toArray() : []
    const copiedFiles = sourceFiles.map((file) => ({ ...file, id: remapped.ids.get(file.id)!, projectId: remapped.project.id, blob: file.blob.slice(0, file.blob.size, file.blob.type) }))
    const persist = async () => {
      await database.projects.put(remapped.project)
      if (copiedFiles.length && hasAttachments(database)) await database.attachments.bulkPut(copiedFiles)
    }
    if (typeof database.transaction === 'function' && hasAttachments(database)) await database.transaction('rw', database.projects, database.attachments, persist)
    else await persist()
    set((state) => ({ projects: [summary(remapped.project), ...state.projects], activeProject: remapped.project, history: [], redoStack: [], saveStatus: 'saved', saveError: null, conflictProject: null }))
  },
  applyDocument: (next, recordHistory = true) => {
    const previous = get().activeProject
    if (!previous) return
    const document = parseProjectDocument({ ...copy(next), updatedAt: timestamp(), revision: previous.revision + 1 })
    set((state) => ({
      activeProject: document,
      history: recordHistory ? [...state.history, copy(previous)].slice(-HISTORY_LIMIT) : state.history,
      redoStack: recordHistory ? [] : state.redoStack,
      saveStatus: 'pending', saveError: null, conflictProject: null,
      projects: state.projects.map((project) => project.id === document.id ? summary(document) : project),
    }))
    scheduleSave()
  },
  renameProject: (name) => {
    const project = get().activeProject
    if (project && name.trim()) get().applyDocument({ ...project, name: name.trim() })
  },
  addNode: (position = { x: 80, y: 80 }, typeId) => {
    const active = get().activeProject
    if (!active) return
    const prepared = defaultType(active)
    const type = typeId === undefined ? prepared.type : active.nodeTypes.find((item) => item.id === typeId)
    if (!type) return
    const node = newNode(type, position)
    get().applyDocument({ ...prepared.project, nodes: [...prepared.project.nodes, node] })
    return node.id
  },
  addChildNode: (parentId, placement) => {
    const project = get().activeProject
    const parent = project?.nodes.find((node) => node.id === parentId)
    const type = project?.nodeTypes.find((item) => item.id === parent?.typeId)
    if (!project || !parent || !type) return
    const position = placement === 'child' ? { x: parent.position.x + parent.size.width + 60, y: parent.position.y } : { x: parent.position.x, y: parent.position.y + parent.size.height + 60 }
    const node = withParent(newNode(type, position), parent.parentGroupId, position)
    const incoming = placement === 'sibling' ? project.connections.find((edge) => edge.targetNodeId === parentId && edge.sourceNodeId !== parentId) : undefined
    const connection: ConnectionEntity = { id: crypto.randomUUID(), sourceNodeId: incoming?.sourceNodeId ?? parentId, targetNodeId: node.id, label: '', relation: 'connects to', properties: {} }
    get().applyDocument({ ...project, nodes: [...project.nodes, node], connections: [...project.connections, connection] })
    return node.id
  },
  moveNodes: (positions) => {
    const project = get().activeProject
    if (project) get().applyDocument({ ...project, nodes: project.nodes.map((node) => positions[node.id] ? { ...node, position: positions[node.id] } : node) })
  },
  moveElements: (positions) => {
    const project = get().activeProject
    if (!project) return
    get().applyDocument({ ...project, nodes: project.nodes.map((node) => positions[node.id] ? { ...node, position: positions[node.id] } : node), groups: project.groups.map((group) => positions[group.id] ? { ...group, position: positions[group.id] } : group), notes: project.notes.map((note) => positions[note.id] ? { ...note, position: positions[note.id] } : note) })
  },
  createGroup: (ids) => {
    const project = get().activeProject
    if (!project) return
    const selected = new Set(ids); const selectedGroups = project.groups.filter((group) => selected.has(group.id))
    const selectedGroupIds = new Set(selectedGroups.map((group) => group.id))
    const topGroups = selectedGroups.filter((group) => !group.parentGroupId || !selectedGroupIds.has(group.parentGroupId))
    const nodes = project.nodes.filter((node) => selected.has(node.id))
    const items = [...nodes, ...topGroups]
    if (!items.length) return
    const parents = new Set(items.map((item) => item.parentGroupId))
    const parentGroupId = parents.size === 1 ? items[0].parentGroupId : undefined
    const bounds = groupBounds(items.map((item) => ({ position: absolutePosition(item, project.groups), size: item.size })))
    const groupId = crypto.randomUUID()
    const groupPosition = relativePosition(bounds.position, parentGroupId, project.groups)
    const group: GroupEntity = { id: groupId, title: 'New group', color: '#5c9cff', position: groupPosition, size: bounds.size, ...(parentGroupId ? { parentGroupId } : {}) }
    const groups = [...project.groups, group]
    const nodeIds = new Set(nodes.map((node) => node.id)); const groupIds = new Set(topGroups.map((item) => item.id))
    get().applyDocument({ ...project, groups: groups.map((item) => groupIds.has(item.id) ? { ...item, parentGroupId: groupId, position: relativePosition(absolutePosition(item, project.groups), groupId, groups) } : item), nodes: project.nodes.map((node) => nodeIds.has(node.id) ? { ...node, parentGroupId: groupId, position: relativePosition(absolutePosition(node, project.groups), groupId, groups) } : node) })
  },
  changeGroupParent: (groupId, parentGroupId) => {
    const project = get().activeProject; const group = project?.groups.find((item) => item.id === groupId)
    if (!project || !group || (parentGroupId && !project.groups.some((item) => item.id === parentGroupId))) return
    if (parentGroupId && descendantGroupIds(groupId, project.groups).has(parentGroupId)) return
    const position = relativePosition(absolutePosition(group, project.groups), parentGroupId, project.groups)
    get().applyDocument({ ...project, groups: project.groups.map((item) => item.id === groupId ? withParent(item, parentGroupId, position) : item) })
  },
  ungroup: (groupId) => {
    const project = get().activeProject
    if (project?.groups.some((group) => group.id === groupId)) get().deleteSelection([groupId])
  },
  deleteGroup: (groupId, descendants = false) => {
    const project = get().activeProject; const group = project?.groups.find((item) => item.id === groupId)
    if (!project || !group) return
    if (!descendants) { get().ungroup(groupId); return }
    const removedGroups = descendantGroupIds(groupId, project.groups)
    const removedNodes = project.nodes.filter((node) => node.parentGroupId && removedGroups.has(node.parentGroupId)).map((node) => node.id)
    get().deleteSelection([...removedGroups, ...removedNodes])
  },
  resizeGroup: (groupId, size, position) => {
    const project = get().activeProject; const group = project?.groups.find((item) => item.id === groupId)
    if (!project || !group) return
    const children = [...project.nodes.filter((item) => item.parentGroupId === groupId), ...project.groups.filter((item) => item.parentGroupId === groupId), ...project.notes.flatMap((item) => item.association.kind === 'group' && item.association.id === groupId && item.position ? [{ position: item.position, size: { width: 260, height: 180 } }] : [])]
    const nextPosition = position ? { x: Math.min(position.x, group.position.x + Math.min(group.size.width - 160, ...children.map((item) => item.position.x))), y: Math.min(position.y, group.position.y + Math.min(group.size.height - 120, ...children.map((item) => item.position.y))) } : group.position
    const delta = { x: group.position.x - nextPosition.x, y: group.position.y - nextPosition.y }
    const shifted = (point: NodeEntity['position']) => ({ x: point.x + delta.x, y: point.y + delta.y })
    const minWidth = Math.max(160, ...children.map((item) => item.position.x + delta.x + item.size.width + 20)); const minHeight = Math.max(120, ...children.map((item) => item.position.y + delta.y + item.size.height + 20))
    get().applyDocument({ ...project,
      groups: project.groups.map((item) => item.id === groupId ? { ...item, position: nextPosition, size: { width: Math.max(size.width, minWidth), height: Math.max(size.height, minHeight) } } : item.parentGroupId === groupId ? { ...item, position: shifted(item.position) } : item),
      nodes: project.nodes.map((item) => item.parentGroupId === groupId ? { ...item, position: shifted(item.position) } : item),
      notes: project.notes.map((item) => item.association.kind === 'group' && item.association.id === groupId && item.position ? { ...item, position: shifted(item.position) } : item),
    })
  },
  updateGroup: (id, patch) => {
    const project = get().activeProject
    if (project) get().applyDocument({ ...project, groups: project.groups.map((group) => group.id === id ? { ...group, ...patch } : group) })
  },
  updateNode: (id, patch) => {
    const project = get().activeProject
    if (project) get().applyDocument({ ...project, nodes: project.nodes.map((node) => node.id === id ? { ...node, ...patch } : node) })
  },
  updateConnection: (id, patch) => {
    const project = get().activeProject
    if (project) get().applyDocument({ ...project, connections: project.connections.map((connection) => connection.id === id ? { ...connection, ...patch } : connection) })
  },
  addNote: (association, position) => {
    const project = get().activeProject
    if (!project) return
    const note: NoteEntity = { id: crypto.randomUUID(), title: 'New note', category: 'general', markdown: '', association: association ?? { kind: 'project', id: project.id }, ...(position ? { position } : {}) }
    get().applyDocument({ ...project, notes: [...project.notes, note] })
  },
  updateNote: (id, patch) => {
    const project = get().activeProject
    if (project) get().applyDocument({ ...project, notes: project.notes.map((note) => note.id === id ? { ...note, ...patch } : note) })
  },
  resizeNote: (id, size, position) => {
    const project = get().activeProject
    if (project) get().applyDocument({ ...project, notes: project.notes.map((note) => note.id === id ? { ...note, size, ...(position ? { position } : {}) } : note) })
  },
  deleteNote: (id) => { const project = get().activeProject; if (project) get().applyDocument({ ...project, notes: project.notes.filter((note) => note.id !== id) }) },
  addNodeType: (name, color = '#7c6cff', icon = '◇') => {
    const project = get().activeProject
    if (project && name.trim()) get().applyDocument({ ...project, nodeTypes: [...project.nodeTypes, { id: crypto.randomUUID(), name: name.trim(), color, icon, fields: [] }] })
  },
  updateNodeType: (id, patch) => {
    const project = get().activeProject; if (!project) return false
    try { get().applyDocument({ ...project, nodeTypes: project.nodeTypes.map((type) => type.id === id ? { ...type, ...patch } : type) }); return true } catch { return false }
  },
  removeNodeType: (id) => {
    const project = get().activeProject
    if (!project || project.nodes.some((node) => node.typeId === id)) return false
    get().applyDocument({ ...project, nodeTypes: project.nodeTypes.filter((type) => type.id !== id) }); return true
  },
  copySelection: (ids) => {
    const project = get().activeProject
    if (!project) return
    const selected = new Set(ids)
    const selectedGroups = new Set(project.groups.filter((group) => selected.has(group.id)).flatMap((group) => [...descendantGroupIds(group.id, project.groups)]))
    const nodes = project.nodes.filter((node) => selected.has(node.id) || (node.parentGroupId !== undefined && selectedGroups.has(node.parentGroupId)))
    const nodeIds = new Set(nodes.map((node) => node.id))
    clipboard = {
      nodes: copy(nodes),
      groups: copy(project.groups.filter((group) => selectedGroups.has(group.id))),
      notes: copy(project.notes.filter((note) => selected.has(note.id) || (note.position && note.association.kind === 'group' && selectedGroups.has(note.association.id)))),
      connections: copy(project.connections.filter((connection) => nodeIds.has(connection.sourceNodeId) && nodeIds.has(connection.targetNodeId))),
      nodeTypes: copy(project.nodeTypes.filter((type) => nodes.some((node) => node.typeId === type.id))),
    }
  },
  pasteClipboard: () => {
    const project = get().activeProject
    if (!project || !clipboard || (!clipboard.nodes.length && !clipboard.groups.length && !clipboard.notes.length)) return
    const typeIds = new Map<string, string>()
    const additions = [...project.nodeTypes]
    for (const sourceType of clipboard.nodeTypes) {
      const same = additions.find((targetType) => typeSignature(targetType) === typeSignature(sourceType))
      if (same) { typeIds.set(sourceType.id, same.id); continue }
      const newType = { ...copy(sourceType), id: crypto.randomUUID(), fields: sourceType.fields.map((field) => ({ ...field, id: crypto.randomUUID() })) }
      additions.push(newType); typeIds.set(sourceType.id, newType.id)
    }
    const ids = new Map(clipboard.nodes.map((node) => [node.id, crypto.randomUUID()]))
    const groupIds = new Map(clipboard.groups.map((group) => [group.id, crypto.randomUUID()]))
    const targetGroupIds = new Set(project.groups.map((group) => group.id))
    const groups = clipboard.groups.map((group) => {
      const { parentGroupId: sourceParentId, ...copyable } = copy(group)
      const parentGroupId = sourceParentId && groupIds.has(sourceParentId) ? groupIds.get(sourceParentId) : sourceParentId && targetGroupIds.has(sourceParentId) ? sourceParentId : undefined
      return { ...copyable, id: groupIds.get(group.id)!, position: sourceParentId && groupIds.has(sourceParentId) ? group.position : { x: group.position.x + 40, y: group.position.y + 40 }, ...(parentGroupId ? { parentGroupId } : {}) }
    })
    const nodes = clipboard.nodes.map((node) => {
      const { parentGroupId: sourceParentId, ...copyable } = copy(node)
      const parentGroupId = sourceParentId && groupIds.has(sourceParentId) ? groupIds.get(sourceParentId) : sourceParentId && targetGroupIds.has(sourceParentId) ? sourceParentId : undefined
      return { ...copyable, id: ids.get(node.id)!, typeId: typeIds.get(node.typeId)!, position: sourceParentId && groupIds.has(sourceParentId) ? node.position : { x: node.position.x + 40, y: node.position.y + 40 }, ...(parentGroupId ? { parentGroupId } : {}) }
    })
    const connections = clipboard.connections.map((connection) => ({ ...copy(connection), id: crypto.randomUUID(), sourceNodeId: ids.get(connection.sourceNodeId)!, targetNodeId: ids.get(connection.targetNodeId)! }))
    const notes = clipboard.notes.map((note) => {
      const id = crypto.randomUUID(); const association = note.association.kind === 'node' && ids.has(note.association.id) ? { kind: 'node' as const, id: ids.get(note.association.id)! } : note.association.kind === 'group' && groupIds.has(note.association.id) ? { kind: 'group' as const, id: groupIds.get(note.association.id)! } : { kind: 'project' as const, id: project.id }
      return { ...copy(note), id, association, ...(note.position ? { position: { x: note.position.x + (association.kind === 'group' ? 0 : 40), y: note.position.y + (association.kind === 'group' ? 0 : 40) } } : {}) }
    })
    get().applyDocument({ ...project, nodeTypes: additions, groups: [...project.groups, ...groups], nodes: [...project.nodes, ...nodes], connections: [...project.connections, ...connections], notes: [...project.notes, ...notes] })
  },
  duplicateSelection: (ids) => { get().copySelection(ids); get().pasteClipboard() },
  removeNodes: (ids) => {
    const project = get().activeProject
    if (project) get().deleteSelection(project.nodes.filter((node) => ids.includes(node.id)).map((node) => node.id))
  },
  deleteSelection: (ids) => {
    const project = get().activeProject
    if (!project) return
    const selected = new Set(ids)
    const removed = new Set([...project.nodes, ...project.groups, ...project.notes, ...project.connections].filter((item) => selected.has(item.id)).map((item) => item.id))
    if (!removed.size) return
    project.connections.forEach((edge) => { if (removed.has(edge.sourceNodeId) || removed.has(edge.targetNodeId)) removed.add(edge.id) })
    const survivingParent = (parentId: string | undefined): string | undefined => {
      while (parentId && removed.has(parentId)) parentId = project.groups.find((group) => group.id === parentId)?.parentGroupId
      return parentId
    }
    const reparent = <T extends NodeEntity | GroupEntity>(item: T): T => {
      if (!item.parentGroupId || !removed.has(item.parentGroupId)) return item
      const parentId = survivingParent(item.parentGroupId)
      return withParent(item, parentId, relativePosition(absolutePosition(item, project.groups), parentId, project.groups))
    }
    get().applyDocument({ ...project,
      nodes: project.nodes.filter((node) => !removed.has(node.id)).map(reparent),
      groups: project.groups.filter((group) => !removed.has(group.id)).map(reparent),
      connections: project.connections.filter((edge) => !removed.has(edge.id)),
      notes: project.notes.filter((note) => !removed.has(note.id)).map((note) => removed.has(note.association.id) ? { ...note, association: { kind: 'project', id: project.id }, ...(note.association.kind === 'group' && note.position ? { position: absolutePosition({ position: note.position, parentGroupId: note.association.id }, project.groups) } : {}) } : note),
      attachments: project.attachments.map((attachment) => ({ ...attachment, associations: attachment.associations.filter((association) => !removed.has(association.id)) })),
    })
  },
  connectNodes: (sourceNodeId, targetNodeId, sourceHandle, targetHandle) => {
    const project = get().activeProject
    if (!project || sourceNodeId === targetNodeId || !project.nodes.some((node) => node.id === sourceNodeId) || !project.nodes.some((node) => node.id === targetNodeId) || project.connections.some((edge) => edge.sourceNodeId === sourceNodeId && edge.targetNodeId === targetNodeId)) return
    const connection: ConnectionEntity = { id: crypto.randomUUID(), sourceNodeId, targetNodeId, ...(sourceHandle ? { sourceHandle } : {}), ...(targetHandle ? { targetHandle } : {}), label: '', relation: 'connects to', properties: {} }
    get().applyDocument({ ...project, connections: [...project.connections, connection] })
  },
  disconnect: (id) => {
    const project = get().activeProject
    if (project?.connections.some((edge) => edge.id === id)) get().deleteSelection([id])
  },
  undo: () => {
    const { activeProject, history, redoStack } = get(); const previous = history.at(-1)
    if (!activeProject || !previous) return
    const restored = parseProjectDocument({ ...copy(previous), updatedAt: timestamp(), revision: activeProject.revision + 1 })
    set((state) => ({ activeProject: restored, history: history.slice(0, -1), redoStack: [...redoStack, copy(activeProject)].slice(-HISTORY_LIMIT), projects: state.projects.map((project) => project.id === restored.id ? summary(restored) : project), saveStatus: 'pending', saveError: null, conflictProject: null }))
    scheduleSave()
  },
  redo: () => {
    const { activeProject, history, redoStack } = get(); const next = redoStack.at(-1)
    if (!activeProject || !next) return
    const restored = parseProjectDocument({ ...copy(next), updatedAt: timestamp(), revision: activeProject.revision + 1 })
    set((state) => ({ activeProject: restored, history: [...history, copy(activeProject)].slice(-HISTORY_LIMIT), redoStack: redoStack.slice(0, -1), projects: state.projects.map((project) => project.id === restored.id ? summary(restored) : project), saveStatus: 'pending', saveError: null, conflictProject: null }))
    scheduleSave()
  },
  saveNow: async () => {
    const project = get().activeProject
    if (!project) return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = undefined
    set({ saveStatus: 'saving', saveError: null })
    const save = async (): Promise<void> => {
      try {
        const snapshot = copy(project)
        let conflict: ProjectDocument | undefined
        const write = async (): Promise<void> => {
          if (hasProjectRead(database)) {
            const saved = await database.projects.get(snapshot.id)
            if (saved) {
              const parsed = parseProjectDocument(saved)
              // Both tabs may produce the same local revision. Comparing the
              // full document closes that tie without silently overwriting.
              if (parsed.revision > snapshot.revision || (parsed.revision === snapshot.revision && !documentsMatch(parsed, snapshot))) {
                conflict = parsed
                return
              }
            }
          }
          await database.projects.put(snapshot)
        }
        if (typeof database.transaction === 'function' && hasProjectRead(database)) await database.transaction('rw', database.projects, write)
        else await write()
        if (conflict) {
          set({ saveStatus: 'conflict', saveError: new SaveConflictError().message, conflictProject: conflict })
          return
        }
        const current = get().activeProject
        if (current?.id === snapshot.id && current.revision === snapshot.revision) set({ saveStatus: 'saved', saveError: null })
        else if (current?.id === snapshot.id) set({ saveStatus: 'pending' })
      } catch (error) {
        set({ saveStatus: 'error', saveError: error instanceof Error ? error.message : 'Unable to save this project.', conflictProject: null })
      }
    }
    const queued = saveChain.then(save)
    saveChain = queued.catch(() => undefined)
    await queued
  },
  retrySave: async () => { if (get().activeProject) { set({ saveStatus: 'pending', saveError: null, conflictProject: null }); scheduleSave(); await get().saveNow() } },
  reloadSavedProject: async () => {
    const id = get().activeProject?.id
    if (!id || !hasProjectRead(database)) return
    const saved = await readStoredProject(id)
    if (!saved) return
    if (saveTimer) clearTimeout(saveTimer)
    const project = parseProjectDocument(saved)
    set((state) => ({ activeProject: project, projects: state.projects.map((item) => item.id === project.id ? summary(project) : item), history: [], redoStack: [], saveStatus: 'saved', saveError: null, conflictProject: null }))
  },
  exportProject: () => get().activeProject ? JSON.stringify(get().activeProject, null, 2) : null,
  exportBackup: async () => {
    const project = get().activeProject
    return project ? exportProjectBackup(database, project) : null
  },
  importProject: async (json) => {
    let source: ProjectDocument
    try {
      const raw: unknown = JSON.parse(json)
      if (typeof raw === 'object' && raw !== null && 'document' in raw && 'files' in raw) {
        const parsed = await parseBackup(json)
        const remapped = remapImportedProject(parsed.document)
        const files = parsed.files.map((file) => ({ ...file, id: remapped.ids.get(file.id)!, projectId: remapped.project.id }))
        const persist = async () => { await database.projects.put(remapped.project); if (files.length && hasAttachments(database)) await database.attachments.bulkPut(files) }
        if (typeof database.transaction === 'function' && hasAttachments(database)) await database.transaction('rw', database.projects, database.attachments, persist)
        else await persist()
        set((state) => ({ projects: [summary(remapped.project), ...state.projects], activeProject: remapped.project, history: [], redoStack: [], saveStatus: 'saved', saveError: null, conflictProject: null }))
        return
      }
      if (typeof raw === 'object' && raw !== null && 'schemaVersion' in raw && typeof (raw as { schemaVersion: unknown }).schemaVersion === 'number' && (raw as { schemaVersion: number }).schemaVersion > 1) throw new Error('This backup was made by a newer version of Mind Map and cannot be imported.')
      source = parseProjectDocument(raw)
    } catch (error) { throw new Error(error instanceof Error && error.message.includes('newer version') ? error.message : 'Invalid project JSON. No projects were changed.') }
    const project = remapImportedProject(source).project
    await database.projects.put(project)
    set((state) => ({ projects: [summary(project), ...state.projects], activeProject: project, history: [], redoStack: [], saveStatus: 'saved', saveError: null, conflictProject: null }))
  },
  addAttachmentFile: async (file, associations) => {
    const project = get().activeProject
    if (!project) return
    try {
      const next = await addAttachment(database, project, file, associations)
      set((state) => ({ activeProject: next, projects: state.projects.map((item) => item.id === next.id ? summary(next) : item) }))
    } catch (error) {
      set({ saveStatus: 'error', saveError: error instanceof Error ? error.message : 'Unable to add attachment.' })
    }
  },
  removeAttachment: (attachmentId) => {
    const project = get().activeProject
    const attachment = project?.attachments.find((item) => item.id === attachmentId)
    if (!project || !attachment) return
    get().applyDocument({ ...project, attachments: project.attachments.filter((item) => item.id !== attachmentId) })
    if (attachment.location.kind === 'local' && hasAttachments(database)) void database.attachments.delete(attachmentId)
  },
}))

export function configureProjectDatabase(next: ProjectDatabase): void { database = next }
export function resetProjectStoreForTests(): void { if (saveTimer) clearTimeout(saveTimer); saveChain = Promise.resolve(); useProjectStore.setState({ projects: [], activeProject: null, history: [], redoStack: [], saveStatus: 'saved', saveError: null, conflictProject: null }) }
