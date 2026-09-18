import { createEmptyProject, type ProjectDocument } from '../domain/project'

export type ProjectTemplateId = 'blank' | 'system-design' | 'network'
export type ProjectTemplate = { id: ProjectTemplateId; name: string; description: string; nodeTypes: Array<{ name: string; color: string; icon: string }> }

export const projectTemplates: ProjectTemplate[] = [
  { id: 'blank', name: 'Blank', description: 'Start empty with a single generic concept type.', nodeTypes: [{ name: 'Concept', color: '#7c6cff', icon: 'diamond' }] },
  { id: 'system-design', name: 'System Design', description: 'Frontend, backend, data stores, and infrastructure types ready to go.', nodeTypes: [
    ['Frontend', '#7c6cff', 'monitor'], ['Backend', '#5c9cff', 'server'], ['API', '#62c6a4', 'arrow-left-right'], ['Database', '#e3a968', 'database'], ['Cache', '#e580a1', 'zap'], ['Queue', '#d5b86a', 'layers'], ['CDN', '#6dc6d7', 'globe'], ['Load Balancer', '#b897e7', 'split'], ['Object Storage', '#8793a8', 'archive'],
  ].map(([name, color, icon]) => ({ name, color, icon })) },
  { id: 'network', name: 'Network', description: 'Routers, switches, firewalls, and endpoints for network diagrams.', nodeTypes: [
    ['Router', '#7c6cff', 'router'], ['Switch', '#5c9cff', 'network'], ['Firewall', '#e58070', 'shield'], ['VLAN', '#62c6a4', 'layers'], ['Server', '#e3a968', 'server'], ['Endpoint', '#8793a8', 'monitor'],
  ].map(([name, color, icon]) => ({ name, color, icon })) },
]

export function createProjectFromTemplate(templateId: ProjectTemplateId = 'blank', name?: string): ProjectDocument {
  const template = projectTemplates.find((item) => item.id === templateId) ?? projectTemplates[0]
  const project = createEmptyProject({ name })
  return { ...project, nodeTypes: template.nodeTypes.map((type) => ({ id: crypto.randomUUID(), ...type, fields: [] })) }
}
