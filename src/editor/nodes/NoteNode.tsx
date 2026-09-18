import { NodeResizer, type Node, type NodeProps } from '@xyflow/react'
import { useLayoutEffect, useRef, useState } from 'react'
import type { CanvasNoteData } from '../adapter'
import { renderSafeMarkdown } from '../../notes/markdown'
import { useEditorActions } from './context'

export function NoteNode({ id, data, selected }: NodeProps<Node<CanvasNoteData, 'note'>>): React.JSX.Element {
  const actions = useEditorActions()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(data.markdown)
  const finished = useRef(false)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const begin = (): void => { finished.current = false; setDraft(data.markdown); setEditing(true) }
  useLayoutEffect(() => { if (editing) textarea.current?.focus() }, [editing])
  const finish = (save: boolean): void => {
    if (finished.current) return
    finished.current = true
    if (save && draft !== data.markdown) actions.updateNote(id, { markdown: draft })
    setEditing(false)
  }
  return (
    <>
      <NodeResizer isVisible={selected} minWidth={160} minHeight={110} handleStyle={{ width: 8, height: 8 }} onResizeEnd={(_, size) => actions.resizeNote(id, { width: size.width, height: size.height }, { x: size.x, y: size.y })} />
      <article className={`note-node note-node--${data.category}`}>
        <span className="note-node-badge">{data.category}</span>
        <strong>{data.title}</strong>
        {editing
          ? <textarea ref={textarea} className="note-node-input nodrag nowheel" aria-label="Note markdown" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => finish(true)} onKeyDown={(event) => { if (event.key === 'Escape' || (event.key === 'Enter' && (event.ctrlKey || event.metaKey))) { event.preventDefault(); event.stopPropagation(); finish(event.key !== 'Escape') } }} />
          : <div className="note-node-preview nowheel" onDoubleClick={begin} dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(data.markdown || 'Double-click to edit') }} />}
      </article>
    </>
  )
}
