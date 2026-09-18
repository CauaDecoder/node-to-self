import { ChevronDown, ChevronRight, FileText, FolderTree, Library, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { GroupEntity, NoteEntity, ProjectDocument } from '../../domain/project'
import type { SidebarSection } from '../../store/editor-store'
import type { ProjectSummary } from '../../store/project-store'
import { relativeDate } from './RelativeDate'
import { NodeIcon } from './NodeIcon'
import { Menu, type MenuItem } from './Menu'

const noteCategories: Array<NoteEntity['category'] | 'all'> = ['all', 'general', 'decision', 'requirement', 'documentation', 'prompt']

type SidebarProps = {
  project: ProjectDocument
  projects: ProjectSummary[]
  selectedIds: string[]
  sidebarSections: Record<SidebarSection, boolean>
  onToggleSection: (section: SidebarSection) => void
  onSelectIds: (ids: string[]) => void
  onFocusItem: (id: string) => void
  onOpenNote: (noteId: string) => void
  onAddLibraryNote: () => void
  onCreateProject: () => void
  onOpenProject: (id: string) => void
  onRenameProject: (id: string, name: string) => void
  onDuplicateProject: (id: string) => void
  onExportProject: (id: string) => void
  onDeleteProject: (id: string) => void
  onOpenPalette: () => void
}

export function Sidebar(props: SidebarProps): React.JSX.Element {
  const { project, projects, selectedIds, sidebarSections } = props
  const selected = useMemo(() => new Set(selectedIds), [selectedIds])
  return (
    <nav className="sidebar" aria-label="Workspace sidebar">
      <Section title="Projects" open={sidebarSections.projects} onToggle={() => props.onToggleSection('projects')}>
        <button type="button" className="sidebar-new" onClick={props.onCreateProject}><Plus size={13} aria-hidden="true" /> New project</button>
        <ul className="sidebar-list" aria-label="Projects">
          {projects.map((item) => (
            <li key={item.id} className={item.id === project.id ? 'active' : ''}>
              <button type="button" onClick={() => props.onOpenProject(item.id)}>
                <span className="sidebar-item-title">{item.name}</span>
                <small>{relativeDate(item.updatedAt)}</small>
              </button>
              <Menu ariaLabel={`Project options for ${item.name}`} align="right" label={<span className="menu-glyph" aria-hidden="true">⋯</span>} items={[
                { id: 'rename', label: 'Rename', onSelect: () => props.onRenameProject(item.id, window.prompt('New project name', item.name) || item.name) },
                { id: 'duplicate', label: 'Duplicate', onSelect: () => props.onDuplicateProject(item.id) },
                { id: 'export', label: 'Export', onSelect: () => props.onExportProject(item.id) },
                { id: 'delete', label: 'Delete', danger: true, onSelect: () => props.onDeleteProject(item.id) },
              ] as MenuItem[]} />
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Outline" open={sidebarSections.outline} onToggle={() => props.onToggleSection('outline')}>
        <Outline project={project} selected={selected} onSelect={props.onSelectIds} onFocus={props.onFocusItem} />
      </Section>
      <Section title="Notes" open={sidebarSections.notes} onToggle={() => props.onToggleSection('notes')}>
        <NotesLibrary notes={project.notes} onOpen={props.onOpenNote} onAdd={props.onAddLibraryNote} />
      </Section>
      <button type="button" className="sidebar-search" onClick={props.onOpenPalette} aria-label="Open search"><Search size={13} aria-hidden="true" /> Search</button>
    </nav>
  )
}

function Section({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }): React.JSX.Element {
  const glyph = open ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />
  const icons: Record<string, React.JSX.Element> = {
    Projects: <Library size={13} aria-hidden="true" />,
    Outline: <FolderTree size={13} aria-hidden="true" />,
    Notes: <FileText size={13} aria-hidden="true" />,
  }
  return (
    <section className="sidebar-section">
      <button type="button" className="sidebar-heading" aria-expanded={open} onClick={onToggle}>{icons[title]} {title} {glyph}</button>
      {open && children}
    </section>
  )
}

type OutlineEntry = { id: string; label: string; kind: 'group' | 'node'; color: string; icon?: string; depth: number; parentId?: string }

function outlineEntries(project: ProjectDocument): OutlineEntry[] {
  const entries: OutlineEntry[] = []
  const groups = new Map(project.groups.map((group) => [group.id, group]))
  const childrenOf = (parentId: string | undefined): GroupEntity[] => project.groups.filter((group) => group.parentGroupId === parentId)
  const visitGroup = (group: GroupEntity, depth: number, parentId?: string): void => {
    entries.push({ id: group.id, label: group.title, kind: 'group', color: group.color, depth, parentId })
    project.nodes.filter((node) => node.parentGroupId === group.id).forEach((node) => entries.push({ id: node.id, label: node.title, kind: 'node', color: node.color, icon: node.icon, depth: depth + 1, parentId: group.id }))
    childrenOf(group.id).forEach((child) => visitGroup(child, depth + 1, group.id))
  }
  childrenOf(undefined).forEach((group) => visitGroup(group, 0))
  project.nodes.filter((node) => !node.parentGroupId).forEach((node) => entries.push({ id: node.id, label: node.title, kind: 'node', color: node.color, icon: node.icon, depth: 0 }))
  void groups
  return entries
}

function Outline({ project, selected, onSelect, onFocus }: { project: ProjectDocument; selected: Set<string>; onSelect: (ids: string[]) => void; onFocus: (id: string) => void }): React.JSX.Element {
  const entries = useMemo(() => outlineEntries(project), [project])
  return (
    <ul className="sidebar-list" aria-label="Outline">
      {entries.map((entry) => (
        <li key={`${entry.kind}-${entry.id}`} className={selected.has(entry.id) ? 'active' : ''}>
          <button
            type="button"
            style={{ paddingInlineStart: 10 + entry.depth * 14 }}
            onClick={() => { onSelect([entry.id]); onFocus(entry.id) }}
          >
            {entry.kind === 'node'
              ? <span className="sidebar-icon" style={{ color: entry.color }}><NodeIcon name={entry.icon ?? '◇'} size={12} /></span>
              : <span className="sidebar-glyph" style={{ color: entry.color }} aria-hidden="true">▭</span>}
            <span className="sidebar-item-title">{entry.label}</span>
          </button>
        </li>
      ))}
      {!entries.length && <li className="sidebar-empty">No items yet.</li>}
    </ul>
  )
}

function NotesLibrary({ notes, onOpen, onAdd }: { notes: NoteEntity[]; onOpen: (id: string) => void; onAdd: () => void }): React.JSX.Element {
  const [category, setCategory] = useState<(typeof noteCategories)[number]>('all')
  const visible = notes.filter((note) => category === 'all' || note.category === category)
  return (
    <div className="sidebar-notes">
      <div className="sidebar-notes-tools">
        <select aria-label="Filter notes by category" value={category} onChange={(event) => setCategory(event.target.value as (typeof noteCategories)[number])}>
          {noteCategories.map((item) => <option key={item} value={item}>{item === 'all' ? 'All categories' : item}</option>)}
        </select>
        <button type="button" onClick={onAdd} aria-label="Add library note"><Plus size={13} aria-hidden="true" /></button>
      </div>
      <ul className="sidebar-list" aria-label="Library notes">
        {visible.map((note) => (
          <li key={note.id}>
            <button type="button" onClick={() => onOpen(note.id)}>
              <span className="sidebar-item-title">{note.title}</span>
              <small>{note.category}</small>
            </button>
          </li>
        ))}
        {!visible.length && <li className="sidebar-empty">No notes in this category.</li>}
      </ul>
    </div>
  )
}
