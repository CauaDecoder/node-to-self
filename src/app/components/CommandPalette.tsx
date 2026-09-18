import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactFlowInstance } from '@xyflow/react'
import { searchProject, type SearchResult } from '../../search/projectSearch'
import { useProjectStore } from '../../store/project-store'
import { buildCommands, selectionEntities, type Command } from '../actions'
import type { FlowEdge, FlowNode } from '../../editor/adapter'
import { NodeIcon } from './NodeIcon'

export type PaletteCommand = Command

type PaletteItem = { id: string; title: string; context: string; group: string; disabled?: boolean; icon?: string; run: () => void }

type CommandPaletteProps = {
  project: NonNullable<ReturnType<typeof useProjectStore.getState>['activeProject']>
  flowInstance: ReactFlowInstance<FlowNode, FlowEdge> | null
  onClose: () => void
  onResult: (result: SearchResult) => void
  requestImport: () => void
  exportBackup: () => void
  exportMarkdown: () => void
  beginTitleEdit: (nodeId: string) => void
  addChildAndEditTitle: () => void
  addSiblingAndEditTitle: () => void
  addNodeAtViewportCenter: (typeId?: string) => void
  addLibraryNote: () => void
  confirm: (options: { title: string; description?: string; confirmLabel: string; danger?: boolean; onConfirm: () => void }) => void
}

const groupOf = (result: SearchResult): string => result.kind === 'node' ? 'Nodes' : result.kind === 'group' ? 'Groups' : result.kind === 'note' ? 'Notes' : result.kind === 'connection' ? 'Connections' : 'Commands'

export function CommandPalette(props: CommandPaletteProps): React.JSX.Element {
  const [query, setQuery] = useState(''); const [index, setIndex] = useState(0); const input = useRef<HTMLInputElement>(null)
  useEffect(() => { input.current?.focus() }, [])
  const items = useMemo<PaletteItem[]>(() => {
    const context = {
      project: props.project, flowInstance: props.flowInstance, requestImport: props.requestImport, exportBackup: props.exportBackup, exportMarkdown: props.exportMarkdown,
      beginTitleEdit: props.beginTitleEdit, addChildAndEditTitle: props.addChildAndEditTitle, addSiblingAndEditTitle: props.addSiblingAndEditTitle,
      addNodeAtViewportCenter: props.addNodeAtViewportCenter, addLibraryNote: props.addLibraryNote, confirm: props.confirm,
      selection: selectionEntities(props.project, []),
    }
    const commands: PaletteItem[] = buildCommands(context).map((command) => ({ ...command, group: 'Commands', context: command.shortcut ?? 'Command' }))
    if (!query.trim()) return commands
    const results: PaletteItem[] = searchProject(props.project, query).map((result) => ({ id: result.id, title: result.title, context: result.context, group: groupOf(result), icon: result.kind === 'type' ? undefined : result.kind, run: () => props.onResult(result) }))
    const text = query.toLocaleLowerCase()
    const matched = commands.filter((command) => command.title.toLocaleLowerCase().includes(text)).map((command) => ({ ...command }))
    return [...matched, ...results]
  }, [props, query])
  const flat = items.length ? items : []
  const select = (): void => { const item = flat[index]; if (item && !item.disabled) { item.run(); props.onClose() } }
  return (
    <div className="palette-backdrop" role="presentation" onMouseDown={props.onClose}>
      <section className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette" onMouseDown={(event) => event.stopPropagation()}>
        <input ref={input} aria-label="Search project or commands" placeholder="Search project or commands…" value={query} onChange={(event) => { setQuery(event.target.value); setIndex(0) }} onKeyDown={(event) => { if (event.key === 'Escape') props.onClose(); if (event.key === 'ArrowDown') { event.preventDefault(); setIndex((value) => Math.min(value + 1, Math.max(flat.length - 1, 0))) } if (event.key === 'ArrowUp') { event.preventDefault(); setIndex((value) => Math.max(value - 1, 0)) } if (event.key === 'Enter') { event.preventDefault(); select() } }} />
        <div className="palette-items">
          {(['Commands', 'Nodes', 'Groups', 'Notes', 'Connections'] as const).map((group) => {
            const groupItems = flat.map((item, itemIndex) => ({ item, itemIndex })).filter(({ item }) => item.group === group)
            if (!groupItems.length) return null
            return (
              <div key={group} className="palette-group">
                <span className="palette-group-label">{group}</span>
                {groupItems.map(({ item, itemIndex }) => (
                  <button key={`${item.id}-${itemIndex}`} type="button" className={itemIndex === index ? 'active' : ''} disabled={item.disabled} onMouseEnter={() => setIndex(itemIndex)} onClick={() => { item.run(); props.onClose() }}>
                    {item.icon && <span className="palette-icon"><NodeIcon name={item.icon} size={12} /></span>}
                    <span>{item.title}</span>
                    <small><kbd>{item.context}</kbd></small>
                  </button>
                ))}
              </div>
            )
          })}
          {!flat.length && <p>No matching content.</p>}
        </div>
        <footer>↑↓ Navigate · Enter select · Esc close</footer>
      </section>
    </div>
  )
}
