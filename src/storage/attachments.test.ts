import { describe, expect, it } from 'vitest'
import { createEmptyProject } from '../domain/project'
import { exportMarkdown, MAX_FILE_BYTES, parseBackup } from './attachments'

describe('attachment export', () => {
  it('documents attachments, components, relations and notes in Markdown', () => {
    const project = createEmptyProject({ name: 'Architecture' })
    const markdown = exportMarkdown({ ...project, attachments: [{ id: crypto.randomUUID(), name: 'brief.pdf', mimeType: 'application/pdf', size: 42, associations: [], location: { kind: 'local', reference: 'file' } }] })
    expect(markdown).toContain('# Architecture')
    expect(markdown).toContain('brief.pdf')
  })

  it('defines a 10 MiB single-file limit', () => expect(MAX_FILE_BYTES).toBe(10 * 1024 * 1024))

  it('validates backup bytes against attachment metadata before returning them', async () => {
    const project = createEmptyProject({ name: 'Backup' })
    const attachment = { id: crypto.randomUUID(), name: 'hello.txt', mimeType: 'text/plain', size: 5, associations: [], location: { kind: 'local' as const, reference: 'file' } }
    const document = { ...project, attachments: [attachment] }
    const backup = JSON.stringify({ document, files: [{ id: attachment.id, mimeType: 'text/plain', base64: btoa('hello') }] })
    const parsed = await parseBackup(backup)
    expect(parsed.files[0].blob.size).toBe(5)
    await expect(parseBackup(JSON.stringify({ document, files: [] }))).rejects.toThrow('missing attachment')
  })
})
