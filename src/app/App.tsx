import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ReactFlowProvider, type ReactFlowInstance } from '@xyflow/react'
import { Canvas } from '../editor/Canvas'
import type { FlowEdge, FlowNode } from '../editor/adapter'
import { exportMarkdown } from '../storage/attachments'
import { useEditorStore } from '../store/editor-store'
import { useProjectStore, type ProjectSummary } from '../store/project-store'
import { CommandPalette } from './components/CommandPalette'
import { ConfirmDialog, type ConfirmRequest } from './components/ConfirmDialog'
import { DetailsDrawer } from './components/DetailsDrawer'
import { SelectionToolbar } from './components/SelectionToolbar'
import { CanvasToolbar } from './components/CanvasToolbar'
import { SaveBanner } from './components/SaveBanner'
import { Sidebar } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import { Welcome } from './components/Welcome'
import { useEditorPreferences } from './hooks/useEditorPreferences'
import { useShortcuts } from './hooks/useShortcuts'
import { selectionEntities } from './actions'
import './app.css'

function downloadProject(json: string, name: string, extension = 'json'): void {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${name.replaceAll(/[^a-z0-9]+/gi, '-').toLowerCase() || 'project'}.${extension}`
  anchor.click()
  URL.revokeObjectURL(url)
}

type Editing = { nodeId: string; target: 'title' | 'body'; sequence: number } | null

export function App(): React.JSX.Element {
  return <ReactFlowProvider><EditorApp /></ReactFlowProvider>
}

function EditorApp(): React.JSX.Element {
  const smallViewport = useEditorPreferences()
  const sidebarWidth = useEditorStore((state) => state.sidebarWidth)
  const sidebarOpen = useEditorStore((state) => state.sidebarOpen)
  const sidebarSections = useEditorStore((state) => state.sidebarSections)
  const selectedIds = useEditorStore((state) => state.selectedIds)
  const detailsOpen = useEditorStore((state) => state.detailsOpen)
  const dialog = useEditorStore((state) => state.dialog)
  const store = useProjectStore()
  const [importError, setImportError] = useState<string | null>(null)
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null)
  const [editing, setEditing] = useState<Editing>(null)
  const editSequence = useRef(0)
  const fileInput = useRef<HTMLInputElement>(null)
  const [flowInstanceState, setFlowInstanceState] = useState<ReactFlowInstance<FlowNode, FlowEdge> | null>(null)
  const flowInstance = useRef<ReactFlowInstance<FlowNode, FlowEdge> | null>(null)
  const priorFocus = useRef<HTMLElement | null>(null)
  useEffect(() => { void store.initialize().catch(() => undefined) }, [store.initialize])
  const project = store.activeProject
  const confirm = useCallback((request: ConfirmRequest): void => { setConfirmRequest(request) }, [])
  const beginTitleEdit = useCallback((nodeId: string) => { setEditing({ nodeId, target: 'title', sequence: ++editSequence.current }) }, [])
  const beginBodyEdit = useCallback((nodeId: string) => { setEditing({ nodeId, target: 'body', sequence: ++editSequence.current }) }, [])
  const addChildAndEditTitle = useCallback((): void => {
    const state = useProjectStore.getState()
    const selected = useEditorStore.getState().selectedIds.find((id) => state.activeProject?.nodes.some((node) => node.id === id))
    if (!selected) return
    const id = state.addChildNode(selected, 'child')
    if (id) setEditing({ nodeId: id, target: 'title', sequence: ++editSequence.current })
  }, [])
  const addSiblingAndEditTitle = useCallback((): void => {
    const state = useProjectStore.getState()
    const selected = useEditorStore.getState().selectedIds.find((id) => state.activeProject?.nodes.some((node) => node.id === id))
    if (!selected) return
    const id = state.addChildNode(selected, 'sibling')
    if (id) setEditing({ nodeId: id, target: 'title', sequence: ++editSequence.current })
  }, [])
  const addNodeAtViewportCenter = useCallback((typeId?: string): void => {
    const state = useProjectStore.getState()
    if (!state.activeProject) return
    const instance = flowInstance.current
    const position = instance ? instance.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 }) : { x: 120 + state.activeProject.nodes.length * 30, y: 100 + state.activeProject.nodes.length * 25 }
    state.addNode(position, typeId)
  }, [])
  const addVisualNote = useCallback((): void => {
    const state = useProjectStore.getState()
    if (!state.activeProject) return
    const instance = flowInstance.current
    const position = instance ? instance.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 }) : { x: 180, y: 220 }
    state.addNote({ kind: 'project', id: state.activeProject.id }, position)
  }, [])
  const addLibraryNote = useCallback((): void => { useProjectStore.getState().addNote() }, [])
  const exportCurrentProject = useCallback((): void => {
    const active = useProjectStore.getState().activeProject
    if (!active) return
    void useProjectStore.getState().exportBackup().then((json) => { if (json) downloadProject(json, active.name) }).catch(() => undefined)
  }, [])
  const exportCurrentMarkdown = useCallback((): void => {
    const active = useProjectStore.getState().activeProject
    if (!active) return
    downloadProject(exportMarkdown(active), active.name, 'md')
  }, [])
  const toggleSidebar = useCallback(() => { const editor = useEditorStore.getState(); editor.setSidebarOpen(!editor.sidebarOpen) }, [])
  const selection = useMemo(() => project ? selectionEntities(project, selectedIds) : { nodes: [], groups: [], connections: [], notes: [] }, [project, selectedIds])
  useShortcuts({
    enabled: project !== null,
    flowInstance: flowInstance.current,
    requestImport: () => fileInput.current?.click(),
    exportBackup: exportCurrentProject,
    exportMarkdown: exportCurrentMarkdown,
    beginTitleEdit,
    addChildAndEditTitle,
    addSiblingAndEditTitle,
    addNodeAtViewportCenter,
    addLibraryNote,
    confirm,
    toggleSidebar,
  })
  const registerInstance = useCallback((instance: ReactFlowInstance<FlowNode, FlowEdge>) => { flowInstance.current = instance; setFlowInstanceState(instance) }, [])
  const focusItem = useCallback((id: string) => {
    const editor = useEditorStore.getState()
    editor.setSelectedIds([id])
    editor.setDetailsOpen(false)
    void flowInstance.current?.fitView({ nodes: [{ id }], padding: 0.5, duration: 300 })
  }, [])
  if (!project) return <Welcome projects={store.projects as ProjectSummary[]} onCreateProject={(name, templateId) => void store.createProject(name, templateId)} onOpenProject={(id) => void store.openProject(id)} />
  const requestImport = () => fileInput.current?.click()
  const onImportFile = (file: File) => { void file.text().then(store.importProject).then(() => setImportError(null)).catch((error: unknown) => setImportError(error instanceof Error ? error.message : 'Import failed.')) }
  return (
    <div className="editor-shell">
      <Topbar
        project={project}
        saveStatus={store.saveStatus}
        canUndo={store.history.length > 0}
        canRedo={store.redoStack.length > 0}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={toggleSidebar}
        onRenameProject={store.renameProject}
        onUndo={store.undo}
        onRedo={store.redo}
        onOpenPalette={() => { priorFocus.current = document.activeElement as HTMLElement | null; useEditorStore.getState().setDialog('palette') }}
        onExportBackup={exportCurrentProject}
        onExportMarkdown={exportCurrentMarkdown}
        requestImport={requestImport}
        onDuplicateProject={() => void store.duplicateProject()}
        onDeleteProject={() => confirm({ title: 'Delete project', description: `Delete "${project.name}"? This cannot be undone.`, confirmLabel: 'Delete', danger: true, onConfirm: () => void store.deleteProject(project.id) })}
      />
      <input ref={fileInput} className="visually-hidden" aria-label="Import project file" type="file" accept="application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImportFile(file); event.currentTarget.value = '' }} />
      <main className="workspace" aria-label="Mind Map editor" style={{ display: 'flex', height: 'calc(100dvh - 44px)' }}>
        {smallViewport && sidebarOpen && <button type="button" className="sidebar-backdrop" aria-label="Close sidebar" onClick={toggleSidebar} />}
        {sidebarOpen && (
          <div className="sidebar-shell" style={{ width: sidebarWidth, flexShrink: 0 }}>
          <Sidebar
            project={project}
            projects={store.projects}
            selectedIds={selectedIds}
            sidebarSections={sidebarSections}
            onToggleSection={useEditorStore.getState().toggleSidebarSection}
            onSelectIds={(ids) => useEditorStore.getState().setSelectedIds(ids)}
            onFocusItem={focusItem}
            onOpenNote={(noteId) => { useEditorStore.getState().setSelectedIds([noteId]); useEditorStore.getState().setDetailsOpen(true) }}
            onAddLibraryNote={addLibraryNote}
            onCreateProject={() => void store.createProject('Untitled project')}
            onOpenProject={(id) => void store.openProject(id)}
            onRenameProject={(id, name) => { if (id === project.id) store.renameProject(name) }}
            onDuplicateProject={(id) => void store.duplicateProject(id)}
            onExportProject={(id) => { if (id === project.id) exportCurrentProject() }}
            onDeleteProject={(id) => { const name = store.projects.find((item) => item.id === id)?.name ?? 'this project'; confirm({ title: 'Delete project', description: `Delete "${name}"? This cannot be undone.`, confirmLabel: 'Delete', danger: true, onConfirm: () => void store.deleteProject(id) }) }}
            onOpenPalette={() => useEditorStore.getState().setDialog('palette')}
          />
          </div>
        )}
        <section className="canvas-region" aria-label="Project canvas">
          <Canvas
            project={project}
            registerInstance={registerInstance}
            beginTitleEdit={beginTitleEdit}
            beginBodyEdit={beginBodyEdit}
            editingNodeId={editing?.nodeId ?? null}
            editingTarget={editing?.target ?? 'title'}
            editingSequence={editing?.sequence ?? 0}
          >
            <SelectionToolbar
              project={project}
              selection={selection}
              confirm={confirm}
              beginTitleEdit={beginTitleEdit}
              openDetails={() => useEditorStore.getState().setDetailsOpen(true)}
            />
            <CanvasToolbar
              project={project}
              flowInstance={flowInstanceState}
              selectionCount={selectedIds.length}
              onAddNode={addNodeAtViewportCenter}
              onAddNote={addVisualNote}
              onGroup={() => store.createGroup(selectedIds)}
              onFit={() => void flowInstance.current?.fitView({ padding: 0.2 })}
              onOpenPalette={() => useEditorStore.getState().setDialog('palette')}
            />
          </Canvas>
          {project.nodes.length === 0 && (
            <div className="canvas-empty" aria-hidden="true">
              <span>Start mapping your ideas</span>
              <small>Add a node, then connect it to the next one.</small>
            </div>
          )}
          <SaveBanner
            saveStatus={store.saveStatus}
            saveError={store.saveError}
            importError={importError}
            onRetry={() => void store.retrySave()}
            onReloadSaved={() => void store.reloadSavedProject()}
            onExportBackup={exportCurrentProject}
            onDismissImportError={() => setImportError(null)}
          />
          <DetailsDrawer
            open={detailsOpen}
            project={project}
            selectedIds={selectedIds}
            onClose={() => useEditorStore.getState().setDetailsOpen(false)}
            onAddAttachmentFile={(file, associations) => void store.addAttachmentFile(file, associations)}
            onRemoveAttachment={(attachmentId) => store.removeAttachment(attachmentId)}
          />
        </section>
        {detailsOpen && <div className="drawer-backdrop" aria-hidden="true" />}
      </main>
      {dialog === 'palette' && (
        <CommandPalette
          project={project}
          flowInstance={flowInstanceState}
          onClose={() => { useEditorStore.getState().setDialog('none'); priorFocus.current?.focus() }}
          onResult={(result) => { focusItem(result.id); if (result.kind === 'note') useEditorStore.getState().setDetailsOpen(true) }}
          requestImport={requestImport}
          exportBackup={exportCurrentProject}
          exportMarkdown={exportCurrentMarkdown}
          beginTitleEdit={beginTitleEdit}
          addChildAndEditTitle={addChildAndEditTitle}
          addSiblingAndEditTitle={addSiblingAndEditTitle}
          addNodeAtViewportCenter={addNodeAtViewportCenter}
          addLibraryNote={addLibraryNote}
          confirm={confirm}
        />
      )}
      {confirmRequest && <ConfirmDialog request={confirmRequest} onCancel={() => setConfirmRequest(null)} />}
    </div>
  )
}
