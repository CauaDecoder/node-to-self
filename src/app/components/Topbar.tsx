import { PanelLeft, Redo2, Search, Undo2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ProjectDocument } from '../../domain/project'
import type { SaveStatus } from '../../store/project-store'
import { Menu, type MenuItem } from './Menu'

const saveLabels: Record<SaveStatus, string> = { saved: 'Saved', pending: 'Changes pending', saving: 'Saving…', error: 'Save failed', conflict: 'Conflict detected' }
const saveDetails: Record<SaveStatus, string> = {
  saved: 'All changes are stored in this browser.',
  pending: 'Changes will be saved automatically in a moment.',
  saving: 'Writing to local storage…',
  error: 'Saving failed. Use the banner on the canvas to retry or export.',
  conflict: 'Another tab saved a newer version. Use the banner to keep your changes.',
}

type TopbarProps = {
  project: ProjectDocument
  saveStatus: SaveStatus
  canUndo: boolean
  canRedo: boolean
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onRenameProject: (name: string) => void
  onUndo: () => void
  onRedo: () => void
  onOpenPalette: () => void
  onExportBackup: () => void
  onExportMarkdown: () => void
  requestImport: () => void
  onDuplicateProject: () => void
  onDeleteProject: () => void
}

export function Topbar(props: TopbarProps): React.JSX.Element {
  const { project, saveStatus, canUndo, canRedo, sidebarOpen } = props
  const input = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(project.name)
  useEffect(() => setName(project.name), [project.name])
  useEffect(() => {
    if (saveStatus === 'error' || saveStatus === 'conflict') input.current?.blur()
  }, [saveStatus])
  const menu: MenuItem[] = [
    { id: 'export-backup', label: 'Export backup', onSelect: props.onExportBackup },
    { id: 'import', label: 'Import project', onSelect: props.requestImport },
    { id: 'export-markdown', label: 'Export Markdown', onSelect: props.onExportMarkdown },
    { id: 'duplicate', label: 'Duplicate project', onSelect: props.onDuplicateProject },
    { id: 'delete', label: 'Delete project', danger: true, onSelect: props.onDeleteProject },
  ]
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button type="button" className="icon-button" aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'} aria-expanded={sidebarOpen} onClick={props.onToggleSidebar}><PanelLeft size={15} aria-hidden="true" /></button>
        <span className="brand"><strong>Mind Map</strong></span>
        <input
          ref={input}
          className="project-name"
          aria-label="Project name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={(event) => props.onRenameProject(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
        />
      </div>
      <button type="button" className="search-button" aria-label="Search" aria-keyshortcuts="Control+K Meta+K" onClick={props.onOpenPalette}>
        <Search size={13} aria-hidden="true" />
        <span>Search…</span>
        <kbd>⌘K</kbd>
      </button>
      <div className="topbar-right">
        <span className={`save-status ${saveStatus}`} title={saveDetails[saveStatus]} aria-live="polite"><i /> {saveLabels[saveStatus]}</span>
        <button type="button" className="icon-button" aria-label="Undo" disabled={!canUndo} onClick={props.onUndo}><Undo2 size={15} aria-hidden="true" /></button>
        <button type="button" className="icon-button" aria-label="Redo" disabled={!canRedo} onClick={props.onRedo}><Redo2 size={15} aria-hidden="true" /></button>
        <Menu ariaLabel="Project menu" align="right" items={menu} label={<span className="menu-glyph" aria-hidden="true">⋯</span>} />
      </div>
    </header>
  )
}
