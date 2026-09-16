import { z } from 'zod'

const idSchema = z.string().uuid()
const isoDateSchema = z.string().datetime({ offset: true })
const finiteNumber = z.number().finite()
const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([z.string(), z.boolean(), z.null(), finiteNumber, z.array(jsonValueSchema), z.record(jsonValueSchema)]),
)

const positionSchema = z.object({ x: finiteNumber, y: finiteNumber }).strict()
const sizeSchema = z.object({ width: finiteNumber.positive(), height: finiteNumber.positive() }).strict()

export const fieldDefinitionSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  kind: z.enum(['text', 'number', 'boolean', 'select', 'url']),
  required: z.boolean(),
  options: z.array(z.string().min(1)).optional(),
  defaultValue: jsonValueSchema.optional(),
}).strict()

export const nodeTypeSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  color: z.string().min(1),
  icon: z.string().min(1),
  fields: z.array(fieldDefinitionSchema),
}).strict()

export const nodeSchema = z.object({
  id: idSchema,
  typeId: idSchema,
  title: z.string().min(1),
  description: z.string(),
  tags: z.array(z.string()),
  properties: z.record(jsonValueSchema),
  color: z.string().min(1),
  icon: z.string().min(1),
  position: positionSchema,
  size: sizeSchema,
  parentGroupId: idSchema.optional(),
}).strict()

export const connectionSchema = z.object({
  id: idSchema,
  sourceNodeId: idSchema,
  targetNodeId: idSchema,
  sourceHandle: z.string().min(1).optional(),
  targetHandle: z.string().min(1).optional(),
  label: z.string(),
  relation: z.string().min(1),
  properties: z.record(jsonValueSchema),
}).strict()

export const groupSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  color: z.string().min(1),
  position: positionSchema,
  size: sizeSchema,
  parentGroupId: idSchema.optional(),
}).strict()

export const associationSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('project'), id: idSchema }).strict(),
  z.object({ kind: z.literal('canvas'), id: idSchema }).strict(),
  z.object({ kind: z.literal('node'), id: idSchema }).strict(),
  z.object({ kind: z.literal('connection'), id: idSchema }).strict(),
  z.object({ kind: z.literal('group'), id: idSchema }).strict(),
])

export const noteSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  category: z.enum(['general', 'decision', 'requirement', 'documentation', 'prompt']),
  markdown: z.string(),
  association: associationSchema,
  position: positionSchema.optional(),
}).strict()

export const attachmentSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  mimeType: z.string().min(1),
  size: finiteNumber.nonnegative(),
  associations: z.array(associationSchema),
  location: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('local'), reference: z.string().min(1) }).strict(),
    z.object({ kind: z.literal('url'), reference: z.string().url() }).strict(),
  ]),
}).strict()

export const canvasSchema = z.object({
  id: idSchema,
  backgroundColor: z.string().min(1),
  gridSize: finiteNumber.positive(),
  snapToGrid: z.boolean(),
}).strict()

const projectDocumentShape = z.object({
  schemaVersion: z.literal(1),
  // A monotonic document revision is used by persistence to detect edits made
  // by another tab. It defaults for documents created before ticket 08.
  revision: z.number().int().nonnegative().default(0),
  id: idSchema,
  name: z.string().min(1),
  description: z.string(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  nodeTypes: z.array(nodeTypeSchema),
  canvas: canvasSchema,
  settings: z.object({ showGrid: z.boolean() }).strict(),
  nodes: z.array(nodeSchema),
  connections: z.array(connectionSchema),
  groups: z.array(groupSchema),
  notes: z.array(noteSchema),
  attachments: z.array(attachmentSchema),
}).strict()

function addIssue(context: z.RefinementCtx, path: (string | number)[], message: string): void {
  context.addIssue({ code: z.ZodIssueCode.custom, path, message })
}

function validateAssociation(
  association: Association,
  document: ProjectDocumentDraft,
  context: z.RefinementCtx,
  path: (string | number)[],
): void {
  const existing = {
    project: document.id,
    canvas: document.canvas.id,
    node: new Set(document.nodes.map((node) => node.id)),
    connection: new Set(document.connections.map((connection) => connection.id)),
    group: new Set(document.groups.map((group) => group.id)),
  }
  switch (association.kind) {
    case 'project':
    case 'canvas':
      if (association.id !== existing[association.kind]) addIssue(context, path, 'Association reference does not exist.')
      return
    case 'node':
    case 'connection':
    case 'group':
      if (!existing[association.kind].has(association.id)) addIssue(context, path, 'Association reference does not exist.')
      return
    default: {
      const _exhaustive: never = association
      return _exhaustive
    }
  }
}

type ProjectDocumentDraft = z.infer<typeof projectDocumentShape>
type Association = z.infer<typeof associationSchema>

export const projectDocumentSchema = projectDocumentShape.superRefine((document, context) => {
  const entities: Array<{ id: string; path: (string | number)[] }> = [
    { id: document.id, path: ['id'] },
    { id: document.canvas.id, path: ['canvas', 'id'] },
    ...document.nodeTypes.flatMap((nodeType, index) => [
      { id: nodeType.id, path: ['nodeTypes', index, 'id'] },
      ...nodeType.fields.map((field, fieldIndex) => ({ id: field.id, path: ['nodeTypes', index, 'fields', fieldIndex, 'id'] })),
    ]),
    ...document.nodes.map((node, index) => ({ id: node.id, path: ['nodes', index, 'id'] })),
    ...document.connections.map((connection, index) => ({ id: connection.id, path: ['connections', index, 'id'] })),
    ...document.groups.map((group, index) => ({ id: group.id, path: ['groups', index, 'id'] })),
    ...document.notes.map((note, index) => ({ id: note.id, path: ['notes', index, 'id'] })),
    ...document.attachments.map((attachment, index) => ({ id: attachment.id, path: ['attachments', index, 'id'] })),
  ]
  const ids = new Set<string>()
  for (const entity of entities) {
    if (ids.has(entity.id)) addIssue(context, entity.path, 'IDs must be unique across the document.')
    ids.add(entity.id)
  }

  const typeIds = new Set(document.nodeTypes.map((nodeType) => nodeType.id))
  const nodeIds = new Set(document.nodes.map((node) => node.id))
  const groupIds = new Set(document.groups.map((group) => group.id))
  for (const [index, node] of document.nodes.entries()) {
    if (!typeIds.has(node.typeId)) addIssue(context, ['nodes', index, 'typeId'], 'Node type does not exist.')
    if (node.parentGroupId !== undefined && !groupIds.has(node.parentGroupId)) addIssue(context, ['nodes', index, 'parentGroupId'], 'Parent group does not exist.')
    const nodeType = document.nodeTypes.find((type) => type.id === node.typeId)
    if (nodeType) for (const field of nodeType.fields) {
      const value = node.properties[field.id]
      if (field.required && (value === undefined || value === null || value === '')) addIssue(context, ['nodes', index, 'properties', field.id], 'A required field is missing.')
      if (value === undefined || value === null) continue
      const valid = (field.kind === 'text' || field.kind === 'url') ? typeof value === 'string' : field.kind === 'number' ? typeof value === 'number' : field.kind === 'boolean' ? typeof value === 'boolean' : typeof value === 'string' && (!field.options || field.options.includes(value))
      if (!valid) addIssue(context, ['nodes', index, 'properties', field.id], 'Property value is incompatible with its field definition.')
    }
  }
  for (const [index, connection] of document.connections.entries()) {
    if (!nodeIds.has(connection.sourceNodeId)) addIssue(context, ['connections', index, 'sourceNodeId'], 'Source node does not exist.')
    if (!nodeIds.has(connection.targetNodeId)) addIssue(context, ['connections', index, 'targetNodeId'], 'Target node does not exist.')
  }
  for (const [index, group] of document.groups.entries()) {
    if (group.parentGroupId === group.id) addIssue(context, ['groups', index, 'parentGroupId'], 'A group cannot parent itself.')
    if (group.parentGroupId !== undefined && !groupIds.has(group.parentGroupId)) addIssue(context, ['groups', index, 'parentGroupId'], 'Parent group does not exist.')
  }
  const parents = new Map(document.groups.map((group) => [group.id, group.parentGroupId]))
  for (const group of document.groups) {
    const visited = new Set<string>()
    let currentId: string | undefined = group.id
    while (currentId !== undefined) {
      if (visited.has(currentId)) {
        addIssue(context, ['groups'], 'Groups cannot form a parent cycle.')
        break
      }
      visited.add(currentId)
      currentId = parents.get(currentId)
    }
  }
  for (const [index, note] of document.notes.entries()) validateAssociation(note.association, document, context, ['notes', index, 'association'])
  for (const [attachmentIndex, attachment] of document.attachments.entries()) {
    for (const [associationIndex, association] of attachment.associations.entries()) {
      validateAssociation(association, document, context, ['attachments', attachmentIndex, 'associations', associationIndex])
    }
  }
})

export type ProjectDocument = z.infer<typeof projectDocumentSchema>
export type NodeEntity = z.infer<typeof nodeSchema>
export type ConnectionEntity = z.infer<typeof connectionSchema>
export type GroupEntity = z.infer<typeof groupSchema>
export type NoteEntity = z.infer<typeof noteSchema>

export function parseProjectDocument(input: unknown): ProjectDocument {
  return projectDocumentSchema.parse(input)
}

export function createEmptyProject({ name = 'Untitled project', description = '' }: { name?: string; description?: string } = {}): ProjectDocument {
  const now = new Date().toISOString()
  return parseProjectDocument({
    schemaVersion: 1,
    revision: 0,
    id: crypto.randomUUID(),
    name,
    description,
    createdAt: now,
    updatedAt: now,
    nodeTypes: [],
    canvas: { id: crypto.randomUUID(), backgroundColor: '#101114', gridSize: 20, snapToGrid: false },
    settings: { showGrid: true },
    nodes: [],
    connections: [],
    groups: [],
    notes: [],
    attachments: [],
  })
}
