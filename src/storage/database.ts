import Dexie, { type Table } from 'dexie'
import type { ProjectDocument } from '../domain/project'

export class ProjectDatabase extends Dexie {
  projects!: Table<ProjectDocument, string>
  attachments!: Table<StoredAttachment, string>

  constructor(name = 'mind-map') {
    super(name)
    this.version(1).stores({ projects: 'id, updatedAt' })
    this.version(2).stores({ projects: 'id, updatedAt', attachments: 'id, projectId' })
  }
}

export type StoredAttachment = { id: string; projectId: string; blob: Blob }

export function createProjectDatabase({ name }: { name?: string } = {}): ProjectDatabase {
  return new ProjectDatabase(name)
}
