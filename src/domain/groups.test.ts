import { describe, expect, it } from 'vitest'
import { absolutePosition, descendantGroupIds, relativePosition } from './groups'
import type { GroupEntity } from './project'

const group = (id: string, position: { x: number; y: number }, parentGroupId?: string): GroupEntity => ({ id, title: id, color: '#777', position, size: { width: 300, height: 200 }, ...(parentGroupId ? { parentGroupId } : {}) })

describe('group positions', () => {
  it('converts between absolute and parent-relative coordinates through nested groups', () => {
    const groups = [group('11111111-1111-4111-8111-111111111111', { x: 100, y: 60 }), group('22222222-2222-4222-8222-222222222222', { x: 30, y: 20 }, '11111111-1111-4111-8111-111111111111')]
    const item = { position: { x: 12, y: 8 }, parentGroupId: groups[1].id }
    const absolute = absolutePosition(item, groups)
    expect(absolute).toEqual({ x: 142, y: 88 })
    expect(relativePosition(absolute, groups[0].id, groups)).toEqual({ x: 42, y: 28 })
  })

  it('finds indirect descendants for cycle prevention and deletion', () => {
    const first = group('11111111-1111-4111-8111-111111111111', { x: 0, y: 0 })
    const second = group('22222222-2222-4222-8222-222222222222', { x: 0, y: 0 }, first.id)
    const third = group('33333333-3333-4333-8333-333333333333', { x: 0, y: 0 }, second.id)
    expect(descendantGroupIds(first.id, [first, second, third])).toEqual(new Set([first.id, second.id, third.id]))
  })
})
