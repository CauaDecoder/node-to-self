import type { GroupEntity, NodeEntity } from './project'

export type Point = { x: number; y: number }
type Parentable = Pick<NodeEntity | GroupEntity, 'position' | 'parentGroupId'>

export function absolutePosition(item: Parentable, groups: GroupEntity[]): Point {
  const byId = new Map(groups.map((group) => [group.id, group]))
  const visited = new Set<string>()
  let x = item.position.x; let y = item.position.y; let parentId = item.parentGroupId
  while (parentId) {
    if (visited.has(parentId)) throw new Error('Group hierarchy contains a cycle.')
    visited.add(parentId)
    const parent = byId.get(parentId)
    if (!parent) break
    x += parent.position.x; y += parent.position.y; parentId = parent.parentGroupId
  }
  return { x, y }
}

export function relativePosition(position: Point, parentGroupId: string | undefined, groups: GroupEntity[]): Point {
  if (!parentGroupId) return position
  const parent = groups.find((group) => group.id === parentGroupId)
  if (!parent) throw new Error('Parent group does not exist.')
  const parentPosition = absolutePosition(parent, groups)
  return { x: position.x - parentPosition.x, y: position.y - parentPosition.y }
}

export function descendantGroupIds(groupId: string, groups: GroupEntity[]): Set<string> {
  const descendants = new Set<string>([groupId])
  let changed = true
  while (changed) {
    changed = false
    for (const group of groups) if (group.parentGroupId && descendants.has(group.parentGroupId) && !descendants.has(group.id)) { descendants.add(group.id); changed = true }
  }
  return descendants
}

export function groupBounds(items: Array<{ position: Point; size: { width: number; height: number } }>, padding = 40): { position: Point; size: { width: number; height: number } } {
  const minX = Math.min(...items.map((item) => item.position.x)); const minY = Math.min(...items.map((item) => item.position.y))
  const maxX = Math.max(...items.map((item) => item.position.x + item.size.width)); const maxY = Math.max(...items.map((item) => item.position.y + item.size.height))
  return { position: { x: minX - padding, y: minY - padding }, size: { width: maxX - minX + padding * 2, height: maxY - minY + padding * 2 } }
}
