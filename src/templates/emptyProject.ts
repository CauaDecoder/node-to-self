import { createEmptyProject } from '../domain/project'

/**
 * The initial project template is intentionally thin: future templates can
 * live beside it without coupling the document domain to a subject area.
 */
export function createEmptyProjectTemplate({ name, description }: { name?: string; description?: string } = {}) {
  return createEmptyProject({ name, description })
}
