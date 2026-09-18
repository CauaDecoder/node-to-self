import { Handle, NodeResizer, Position, type Node, type NodeProps } from '@xyflow/react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CanvasNodeData } from '../adapter'
import { useEditorActions } from './context'
import { NodeIcon } from '../../app/components/NodeIcon'
import { renderSafeMarkdown } from '../../notes/markdown'

export function ConceptNode({ id, data, selected }: NodeProps<Node<CanvasNodeData, 'concept'>>): React.JSX.Element {
  const actions = useEditorActions()
  const [editing, setEditing] = useState<'title' | 'body' | null>(null)
  const [draft, setDraft] = useState('')
  const finished = useRef(false)
  const input = useRef<HTMLInputElement>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const card = useRef<HTMLElement>(null)
  const request = actions.editRequest
  const begin = (target: 'title' | 'body') => {
    finished.current = false
    setDraft(target === 'title' ? data.title : data.description)
    setEditing(target)
  }
  useEffect(() => {
    if (request?.nodeId === id) {
      finished.current = false
      setDraft(request.target === 'title' ? data.title : data.description)
      setEditing(request.target)
    }
  }, [request, id])
  useLayoutEffect(() => {
    if (editing === 'title') { input.current?.focus(); input.current?.select() }
    if (editing === 'body') textarea.current?.focus()
  }, [editing])
  useLayoutEffect(() => {
    if (textarea.current) {
      textarea.current.style.height = 'auto'
      textarea.current.style.height = `${textarea.current.scrollHeight}px`
    }
  }, [draft, editing])
  const finish = (save: boolean) => {
    if (finished.current) return
    finished.current = true
    if (save && editing === 'title' && (draft.trim() || 'Untitled node') !== data.title) actions.updateNode(id, { title: draft.trim() || 'Untitled node' })
    if (save && editing === 'body' && draft !== data.description) actions.updateNode(id, { description: draft })
    setEditing(null)
    card.current?.closest<HTMLElement>('.react-flow__node')?.focus()
  }
  return (
    <>
      <NodeResizer isVisible={selected} minWidth={140} minHeight={90} color={data.color} onResizeEnd={(_, size) => actions.resizeNode(id, { width: size.width, height: size.height }, { x: size.x, y: size.y })} />
      <Handle type="target" position={Position.Left} className="concept-handle" />
      <Handle id="top" type="target" position={Position.Top} className="concept-handle" />
      <article ref={card} className="concept-node" style={{ '--concept-color': data.color } as React.CSSProperties}>
        <div className="concept-body-wrap">
          <header className="concept-header">
            <span className="concept-icon" style={{ color: data.color, backgroundColor: `${data.color}18` }}><NodeIcon name={data.icon} /></span>
            <div className="concept-heading">
              {editing === 'title' ? <input ref={input} className="concept-title-input nodrag" aria-label="Node title" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => finish(true)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish(event.key === 'Enter') } }} /> : <strong onDoubleClick={() => begin('title')}>{data.title}</strong>}
              <small>{data.typeName}</small>
            </div>
          </header>
          {editing === 'body' ? <textarea ref={textarea} className="concept-body-input nodrag nowheel" aria-label="Node description" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => finish(true)} onKeyDown={(event) => { if (event.key === 'Escape' || (event.key === 'Enter' && (event.ctrlKey || event.metaKey))) { event.preventDefault(); event.stopPropagation(); finish(event.key !== 'Escape') } }} /> : <div className="concept-body nowheel" onDoubleClick={() => begin('body')} dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(data.description || 'Double-click to add text') }} />}
          {!!data.tags.length && <footer className="concept-tags">{data.tags.map((tag, index) => <span key={`${tag}-${index}`}>{tag}</span>)}</footer>}
        </div>
      </article>
      <Handle type="source" position={Position.Right} className="concept-handle" />
      <Handle id="bottom" type="source" position={Position.Bottom} className="concept-handle" />
    </>
  )
}
