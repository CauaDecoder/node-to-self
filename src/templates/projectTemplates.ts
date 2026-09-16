import { createEmptyProject, type ProjectDocument } from '../domain/project'

export type ProjectTemplateId = 'blank' | 'system-design' | 'network'
export type ProjectTemplate = { id: ProjectTemplateId; name: string; nodeTypes: Array<{ name: string; color: string; icon: string }> }

export const projectTemplates: ProjectTemplate[] = [
  { id: 'blank', name: 'Blank', nodeTypes: [{ name: 'Concept', color: '#7c6cff', icon: '◇' }] },
  { id: 'system-design', name: 'System Design', nodeTypes: [
    ['Frontend', '#7c6cff', '◫'], ['Backend', '#5c9cff', '◆'], ['API', '#62c6a4', '↔'], ['Database', '#e3a968', '▣'], ['Cache', '#e580a1', '◌'], ['Queue', '#d5b86a', '≋'], ['CDN', '#6dc6d7', '◉'], ['Load Balancer', '#b897e7', '⇄'], ['Object Storage', '#8793a8', '◈'],
  ].map(([name, color, icon]) => ({ name, color, icon })) },
  { id: 'network', name: 'Network', nodeTypes: [
    ['Router', '#7c6cff', '◉'], ['Switch', '#5c9cff', '◇'], ['Firewall', '#e58070', '▰'], ['VLAN', '#62c6a4', '▱'], ['Server', '#e3a968', '▣'], ['Endpoint', '#8793a8', '◦'],
  ].map(([name, color, icon]) => ({ name, color, icon })) },
]

export function createProjectFromTemplate(templateId: ProjectTemplateId = 'blank', name?: string): ProjectDocument {
  const template = projectTemplates.find((item) => item.id === templateId) ?? projectTemplates[0]
  const project = createEmptyProject({ name })
  return { ...project, nodeTypes: template.nodeTypes.map((type) => ({ id: crypto.randomUUID(), ...type, fields: [] })) }
}
