import { useStore, type ReactFlowInstance } from '@xyflow/react'
import { Group, Hand, Maximize, Minus, MousePointer2, Plus, Search, StickyNote } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FlowEdge, FlowNode } from '../../editor/adapter'
import type { ProjectDocument } from '../../domain/project'
import { useEditorStore } from '../../store/editor-store'
import { NodeIcon } from './NodeIcon'

type CanvasToolbarProps = {
  project: ProjectDocument
  flowInstance: ReactFlowInstance<FlowNode, FlowEdge> | null
  selectionCount: number
  onAddNode: (typeId?: string) => void
  onAddNote: () => void
  onGroup: () => void
  onFit: () => void
  onOpenPalette: () => void
}

export function CanvasToolbar({ project, flowInstance, selectionCount, onAddNode, onAddNote, onGroup, onFit, onOpenPalette }: CanvasToolbarProps): React.JSX.Element {
  const zoom = useStore((state) => state.transform[2])
  const canvasTool = useEditorStore((state) => state.canvasTool)
  const setCanvasTool = useEditorStore((state) => state.setCanvasTool)
  return (
    <div className="canvas-toolbar" role="toolbar" aria-label="Canvas tools">
      <button type="button" className={canvasTool === 'select' ? 'active' : ''} aria-label="Select tool" aria-pressed={canvasTool === 'select'} title="Select (V)" onClick={() => setCanvasTool('select')}><MousePointer2 size={14} aria-hidden="true" /></button>
      <button type="button" className={canvasTool === 'pan' ? 'active' : ''} aria-label="Pan tool" aria-pressed={canvasTool === 'pan'} title="Pan (H)" onClick={() => setCanvasTool('pan')}><Hand size={14} aria-hidden="true" /></button>
      <TypeMenu project={project} onAddNode={onAddNode} />
      <button type="button" aria-label="Add note" title="Add visual note" onClick={onAddNote}><StickyNote size={14} aria-hidden="true" /></button>
      <button type="button" aria-label="Group selection" title="Group selection (Ctrl/⌘+G)" disabled={selectionCount < 1} onClick={onGroup}><Group size={14} aria-hidden="true" /></button>
      <span className="toolbar-divider" />
      <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => void flowInstance?.zoomOut()}><Minus size={14} aria-hidden="true" /></button>
      <span className="zoom-value" aria-label={`Zoom ${Math.round(zoom * 100)} percent`}>{Math.round(zoom * 100)}%</span>
      <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => void flowInstance?.zoomIn()}><Plus size={14} aria-hidden="true" /></button>
      <button type="button" aria-label="Fit content" title="Fit content (F)" onClick={onFit}><Maximize size={14} aria-hidden="true" /></button>
      <button type="button" aria-label="Open search" title="Search (Ctrl/⌘+K)" onClick={onOpenPalette}><Search aria-hidden="true" size={14} /></button>
    </div>
  )
}

function TypeMenu({ project, onAddNode }: { project: ProjectDocument; onAddNode: (typeId?: string) => void }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent): void => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [open])
  return (
    <span className="menu inline" ref={root}>
      <button type="button" aria-label="Add node" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)}><Plus size={14} aria-hidden="true" /></button>
      {open && (
        <span className="menu-list menu-up" role="menu" aria-label="Node type">
          {project.nodeTypes.map((type) => (
            <button key={type.id} type="button" role="menuitem" onClick={() => { setOpen(false); onAddNode(type.id) }}>
              <span className="menu-item-icon" style={{ color: type.color }}><NodeIcon name={type.icon} size={12} /></span>
              <span className="menu-item-label">{type.name}</span>
            </button>
          ))}
        </span>
      )}
    </span>
  )
}
