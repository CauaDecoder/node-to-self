import { Background, MiniMap, ReactFlow, applyEdgeChanges, applyNodeChanges, type Connection, type EdgeChange, type NodeChange, type ReactFlowInstance } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { documentToFlow, type FlowEdge, type FlowNode } from './adapter'
import { ConceptNode } from './nodes/ConceptNode'
import { GroupNode } from './nodes/GroupNode'
import { LabeledEdge } from './nodes/LabeledEdge'
import { NoteNode } from './nodes/NoteNode'
import { EditorActionsContext, type EditorActions } from './nodes/context'
import { useEditorStore } from '../store/editor-store'
import { useProjectStore } from '../store/project-store'
import type { ProjectDocument } from '../domain/project'

const nodeTypes = { concept: ConceptNode, group: GroupNode, note: NoteNode }
const edgeTypes = { labeled: LabeledEdge }

type SelectionPayload = { nodes: FlowNode[]; edges: FlowEdge[] }

export function Canvas({ project, registerInstance, beginTitleEdit, beginBodyEdit, editingNodeId, editingTarget, editingSequence, children }: CanvasProps): React.JSX.Element {
  const initial = useMemo(() => documentToFlow(project), [])
  const [nodes, setNodes] = useState(initial.nodes)
  const [edges, setEdges] = useState(initial.edges)
  const revisionRef = useRef(project.revision)
  const documentRevision = project.revision
  useEffect(() => {
    if (revisionRef.current === documentRevision) return
    revisionRef.current = documentRevision
    const flow = documentToFlow(project)
    // Rebuilding from the document drops xyflow's internal `selected` flag,
    // so re-apply it from the outgoing state to avoid visually losing the
    // selection on every edit to the selected element.
    setNodes((current) => {
      const selected = new Set(current.filter((node) => node.selected).map((node) => node.id))
      return flow.nodes.map((node) => (selected.has(node.id) ? { ...node, selected: true } : node))
    })
    setEdges((current) => {
      const selected = new Set(current.filter((edge) => edge.selected).map((edge) => edge.id))
      return flow.edges.map((edge) => (selected.has(edge.id) ? { ...edge, selected: true } : edge))
    })
  }, [project, documentRevision])
  const onNodesChange = useCallback((changes: NodeChange<FlowNode>[]) => {
    setNodes((current) => applyNodeChanges(changes, current))
  }, [])
  const onEdgesChange = useCallback((changes: EdgeChange<FlowEdge>[]) => {
    setEdges((current) => applyEdgeChanges(changes, current))
  }, [])
  const updateSelection = useCallback(({ nodes: selectedNodes, edges: selectedEdges }: SelectionPayload) => {
    useEditorStore.getState().setSelectedIds([...selectedNodes.map((node) => node.id), ...selectedEdges.map((edge) => edge.id)])
  }, [])
  const selectedIds = useEditorStore((state) => state.selectedIds)
  useEffect(() => {
    const selected = new Set(selectedIds)
    setNodes((current) => current.some((node) => Boolean(node.selected) !== selected.has(node.id)) ? current.map((node) => ({ ...node, selected: selected.has(node.id) })) : current)
    setEdges((current) => current.some((edge) => Boolean(edge.selected) !== selected.has(edge.id)) ? current.map((edge) => ({ ...edge, selected: selected.has(edge.id) })) : current)
  }, [selectedIds])
  const commitDraggedNode = useCallback((_: unknown, node: FlowNode) => {
    useProjectStore.getState().moveElements({ [node.id]: node.position })
  }, [])
  const onConnect = useCallback((connection: Connection) => {
    if (connection.source && connection.target) useProjectStore.getState().connectNodes(connection.source, connection.target, connection.sourceHandle, connection.targetHandle)
  }, [])
  const minimapVisible = useEditorStore((state) => state.minimapVisible)
  const editorActions = useMemo<EditorActions>(() => ({
    editRequest: editingNodeId ? { nodeId: editingNodeId, target: editingTarget, sequence: editingSequence } : null,
    updateNode: (id, patch) => useProjectStore.getState().updateNode(id, patch),
    resizeNode: (id, size, position) => useProjectStore.getState().updateNode(id, { size, position }),
    resizeGroup: (id, size, position) => useProjectStore.getState().resizeGroup(id, size, position),
    updateGroup: (id, patch) => useProjectStore.getState().updateGroup(id, patch),
    updateNote: (id, patch) => useProjectStore.getState().updateNote(id, patch),
    resizeNote: (id, size, position) => useProjectStore.getState().resizeNote(id, size, position),
  }), [editingNodeId, editingTarget, editingSequence, beginTitleEdit, beginBodyEdit])
  return (
    <EditorActionsContext.Provider value={editorActions}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        nodesDraggable
        nodesConnectable
        elementsSelectable
        selectionOnDrag
        multiSelectionKeyCode={['Control', 'Meta']}
        snapToGrid={project.canvas.snapToGrid}
        snapGrid={[project.canvas.gridSize, project.canvas.gridSize]}
        onInit={registerInstance}
        onSelectionChange={updateSelection}
        onPaneClick={() => useEditorStore.getState().setSelectedIds([])}
        onNodeDragStop={commitDraggedNode}
        onConnect={onConnect}
        onNodesDelete={(deleted) => useProjectStore.getState().removeNodes(deleted.map((node) => node.id))}
        onEdgesDelete={(deleted) => deleted.forEach((edge) => useProjectStore.getState().disconnect(edge.id))}
        proOptions={{ hideAttribution: true }}
      >
        {project.settings.showGrid && <Background gap={project.canvas.gridSize} size={1} color="#303239" />}
        {minimapVisible && <MiniMap pannable zoomable position="bottom-right" className="canvas-minimap" nodeColor={(node: FlowNode) => ('color' in node.data ? String(node.data.color) : '#6b7280')} />}
        {children}
      </ReactFlow>
    </EditorActionsContext.Provider>
  )
}

type CanvasProps = {
  project: ProjectDocument
  registerInstance: (instance: ReactFlowInstance<FlowNode, FlowEdge>) => void
  beginTitleEdit: (nodeId: string) => void
  beginBodyEdit: (nodeId: string) => void
  editingNodeId: string | null
  editingTarget: 'title' | 'body'
  editingSequence: number
  children?: React.ReactNode
}
