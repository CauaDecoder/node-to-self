import { parseProjectDocument, type ProjectDocument } from '../domain/project'
import type { ProjectDatabase, StoredAttachment } from './database'

export const MAX_FILE_BYTES = 10 * 1024 * 1024
export const MAX_PROJECT_BYTES = 50 * 1024 * 1024
export const MAX_IMPORT_BYTES = 75 * 1024 * 1024

const bytesToBase64 = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  return btoa(binary)
}
const base64ToBlob = (base64: string, mimeType: string) => { try { return new Blob([Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))], { type: mimeType }) } catch { throw new Error('Invalid attachment base64.') } }

export type BackupFile = { id: string; mimeType: string; base64: string }
export type ParsedBackup = { document: ProjectDocument; files: StoredAttachment[] }

export async function parseBackup(json: string): Promise<ParsedBackup> {
  if (new Blob([json]).size > MAX_IMPORT_BYTES) throw new Error('Backup exceeds the 75 MiB import limit.')
  let raw: { document?: unknown; files?: BackupFile[] }
  try { raw = JSON.parse(json) as { document?: unknown; files?: BackupFile[] } } catch { throw new Error('Invalid backup JSON.') }
  if (!raw || !Array.isArray(raw.files)) throw new Error('Invalid backup JSON.')
  const document = parseProjectDocument(raw.document)
  const expected = new Map(document.attachments.filter((item) => item.location.kind === 'local').map((item) => [item.id, item]))
  const files: StoredAttachment[] = raw.files.map((file) => {
    if (!file || typeof file.id !== 'string' || typeof file.mimeType !== 'string' || typeof file.base64 !== 'string') throw new Error('Invalid backup file entry.')
    const metadata = expected.get(file.id)
    if (!metadata) throw new Error('Backup contains an unexpected attachment.')
    const blob = base64ToBlob(file.base64, file.mimeType)
    if (blob.size !== metadata.size || blob.type !== metadata.mimeType) throw new Error('Attachment metadata does not match its bytes.')
    return { id: file.id, projectId: document.id, blob }
  })
  if (files.length !== expected.size) throw new Error('Backup is missing attachment bytes.')
  const total = files.reduce((sum, file) => sum + file.blob.size, 0)
  if (total > MAX_PROJECT_BYTES) throw new Error('Project attachments cannot exceed 50 MiB.')
  return { document, files }
}

export async function addAttachment(database: ProjectDatabase, project: ProjectDocument, file: File, associations: ProjectDocument['attachments'][number]['associations']): Promise<ProjectDocument> {
  if (file.size > MAX_FILE_BYTES) throw new Error('Each file must be 10 MiB or smaller.')
  const activeBytes = (await database.attachments.where('projectId').equals(project.id).toArray()).reduce((sum, item) => sum + item.blob.size, 0)
  if (activeBytes + file.size > MAX_PROJECT_BYTES) throw new Error('Project attachments cannot exceed 50 MiB.')
  const id = crypto.randomUUID(); const attachment = { id, name: file.name || 'attachment', mimeType: file.type || 'application/octet-stream', size: file.size, associations, location: { kind: 'local' as const, reference: id } }
  const next = parseProjectDocument({ ...project, attachments: [...project.attachments, attachment] })
  await database.transaction('rw', database.projects, database.attachments, async () => { await database.attachments.put({ id, projectId: project.id, blob: file }); await database.projects.put(next) })
  return next
}

export async function exportBackup(database: ProjectDatabase, project: ProjectDocument): Promise<string> {
  const files = await database.attachments.where('projectId').equals(project.id).toArray()
  return JSON.stringify({ document: project, files: await Promise.all(files.map(async (file) => ({ id: file.id, mimeType: file.blob.type, base64: await bytesToBase64(file.blob) }))) })
}

export async function importBackup(database: ProjectDatabase, json: string): Promise<ProjectDocument> {
  const { document, files } = await parseBackup(json)
  await database.transaction('rw', database.projects, database.attachments, async () => { await database.projects.put(document); await database.attachments.bulkPut(files) })
  return document
}

export function exportMarkdown(project: ProjectDocument): string {
  const rows = [`# ${project.name}`, project.description, '', '## Components', ...project.nodes.map((node) => `- **${node.title}** — ${node.description || 'No description'}`), '', '## Relations', ...project.connections.map((edge) => `- ${edge.sourceNodeId} → ${edge.targetNodeId}: ${edge.relation}`), '', '## Groups', ...project.groups.map((group) => `- ${group.title}`), '', '## Notes', ...project.notes.map((note) => `### ${note.title}\n${note.markdown}`), '', '## Attachments', ...project.attachments.map((attachment) => `- ${attachment.name} (${attachment.mimeType}, ${attachment.size} bytes)`)]
  return rows.filter((line, index) => line !== '' || index === 0 || rows[index - 1] !== '').join('\n')
}
