import { describe, expect, it } from 'vitest'
import { createProjectFromTemplate } from './projectTemplates'

describe('project templates', () => {
  it('creates independent system-design and network definitions', () => {
    const system = createProjectFromTemplate('system-design', 'System')
    const network = createProjectFromTemplate('network', 'Network')
    expect(system.nodeTypes.map((type) => type.name)).toContain('Database')
    expect(network.nodeTypes.map((type) => type.name)).toContain('Firewall')
    const second = createProjectFromTemplate('system-design', 'Second')
    expect(second.nodeTypes[0].id).not.toBe(system.nodeTypes[0].id)
  })
})
