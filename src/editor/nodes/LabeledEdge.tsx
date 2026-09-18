import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react'
import { useLayoutEffect, useRef, useState } from 'react'
import type { FlowEdge } from '../adapter'
import { useProjectStore } from '../../store/project-store'

export function LabeledEdge(props: EdgeProps<FlowEdge>): React.JSX.Element {
  const [path, labelX, labelY] = getSmoothStepPath(props)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(props.label ? String(props.label) : '')
  const input = useRef<HTMLInputElement>(null)
  const begin = (): void => { setDraft(props.label ? String(props.label) : ''); setEditing(true) }
  useLayoutEffect(() => { if (editing) { input.current?.focus(); input.current?.select() } }, [editing])
  const finish = (save: boolean): void => {
    if (save && draft !== props.label) useProjectStore.getState().updateConnection(props.id, { label: draft })
    setEditing(false)
  }
  return (
    <>
      <BaseEdge id={props.id} path={path} markerEnd={props.markerEnd} className={`labeled-edge${props.selected ? ' selected' : ''}`} />
      <EdgeLabelRenderer>
        <div
          className={`edge-label nodrag nopan${!props.label && !editing ? ' edge-label--empty' : ''}`}
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          onDoubleClick={begin}
        >
          {editing
            ? <input ref={input} className="edge-label-input" aria-label="Edge label" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => finish(true)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === 'Escape') { event.preventDefault(); finish(event.key === 'Enter') } }} />
            : (props.label || null)}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
