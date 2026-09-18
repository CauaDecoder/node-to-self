import { NodeResizer, type Node, type NodeProps } from '@xyflow/react'
import { useLayoutEffect, useRef, useState } from 'react'
import { useEditorActions } from './context'
import type { CanvasGroupData } from '../adapter'

export function GroupNode({ id, data, selected }: NodeProps<Node<CanvasGroupData, 'group'>>): React.JSX.Element {
  const actions = useEditorActions()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(data.title)
  const input = useRef<HTMLInputElement>(null)
  const begin = (): void => { setDraft(data.title); setEditing(true) }
  useLayoutEffect(() => { if (editing) { input.current?.focus(); input.current?.select() } }, [editing])
  const finish = (save: boolean): void => {
    if (save && (draft.trim() || 'Untitled group') !== data.title) actions.updateGroup(id, { title: draft.trim() || 'Untitled group' })
    setEditing(false)
  }
  return <>
    <NodeResizer isVisible={selected} minWidth={160} minHeight={120} color={data.color} onResizeEnd={(_, size) => actions.resizeGroup(id, { width: size.width, height: size.height }, { x: size.x, y: size.y })} />
    <div className="group-node" style={{ borderColor: `${data.color}4d`, backgroundColor: `${data.color}0a` }}>
      {editing
        ? <input ref={input} className="group-tab-input nodrag" aria-label="Group title" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => finish(true)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish(event.key === 'Enter') } }} />
        : <span className="group-tab" style={{ color: data.color }} onDoubleClick={begin}>{data.title}</span>}
    </div>
  </>
}
