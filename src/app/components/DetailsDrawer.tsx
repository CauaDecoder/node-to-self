import { useState } from 'react'
import { renderSafeMarkdown } from '../../notes/markdown'
import { useEditorStore } from '../../store/editor-store'
import { useProjectStore } from '../../store/project-store'
import type { AttachmentEntity, ConnectionEntity, FieldDefinition, NodeEntity, NoteEntity, ProjectDocument } from '../../domain/project'
import { useDialogFocus } from '../hooks/useDialogFocus'

type DetailsDrawerProps = {
  open: boolean
  project: ProjectDocument
  selectedIds: string[]
  onClose: () => void
  onAddAttachmentFile: (file: File, associations: AttachmentEntity['associations']) => void
  onRemoveAttachment: (attachmentId: string) => void
}

export function DetailsDrawer({ open, project, selectedIds, onClose, onAddAttachmentFile, onRemoveAttachment }: DetailsDrawerProps): React.JSX.Element | null {
  const entity = selectedIds.length === 1 ? describeSelection(project, selectedIds[0]) : undefined
  if (!open || !entity) return null
  return <DrawerBody key={entity.key} entity={entity} project={project} onClose={onClose} onAddAttachmentFile={onAddAttachmentFile} onRemoveAttachment={onRemoveAttachment} />
}

type DrawerEntity =
  | { key: string; kind: 'node'; node: NodeEntity; noteIds: string[]; attachments: AttachmentEntity[] }
  | { key: string; kind: 'connection'; connection: ConnectionEntity }
  | { key: string; kind: 'note'; note: NoteEntity }
  | { key: string; kind: 'group'; group: ProjectDocument['groups'][number]; noteIds: string[] }

function describeSelection(project: ProjectDocument, id: string): DrawerEntity | undefined {
  const node = project.nodes.find((item) => item.id === id)
  if (node) {
    return {
      key: `node-${node.id}`, kind: 'node', node,
      noteIds: project.notes.filter((note) => note.association.kind === 'node' && note.association.id === node.id).map((note) => note.id),
      attachments: project.attachments.filter((attachment) => attachment.associations.some((association) => association.kind === 'node' && association.id === node.id)),
    }
  }
  const connection = project.connections.find((item) => item.id === id)
  if (connection) return { key: `connection-${connection.id}`, kind: 'connection', connection }
  const note = project.notes.find((item) => item.id === id)
  if (note) return { key: `note-${note.id}`, kind: 'note', note }
  const group = project.groups.find((item) => item.id === id)
  if (group) return { key: `group-${group.id}`, kind: 'group', group, noteIds: project.notes.filter((note) => note.association.kind === 'group' && note.association.id === group.id).map((note) => note.id) }
  return undefined
}

function DrawerBody({ entity, project, onClose, onAddAttachmentFile, onRemoveAttachment }: { entity: DrawerEntity; project: ProjectDocument; onClose: () => void; onAddAttachmentFile: DetailsDrawerProps['onAddAttachmentFile']; onRemoveAttachment: DetailsDrawerProps['onRemoveAttachment'] }): React.JSX.Element {
  const panel = useDialogFocus(onClose)
  const heading = entity.kind === 'node' ? 'Node details' : entity.kind === 'connection' ? 'Connection details' : entity.kind === 'note' ? 'Note details' : 'Group details'
  return (
    <aside className="details-drawer" role="complementary" aria-label="Details drawer" ref={panel} tabIndex={-1}>
      <div className="panel-heading">
        <span className="eyebrow">DETAILS</span>
        <h2>{heading}</h2>
        <button type="button" aria-label="Close details" onClick={onClose}>×</button>
      </div>
      {entity.kind === 'node' && <NodeDetails entity={entity} project={project} onAddAttachmentFile={onAddAttachmentFile} onRemoveAttachment={onRemoveAttachment} />}
      {entity.kind === 'connection' && <ConnectionDetails connection={entity.connection} />}
      {entity.kind === 'note' && <NoteDetails note={entity.note} />}
      {entity.kind === 'group' && <GroupDetails entity={entity} project={project} />}
    </aside>
  )
}

type NodeEntityForDetails = Extract<DrawerEntity, { kind: 'node' }>

function NodeDetails({ entity, project, onAddAttachmentFile, onRemoveAttachment }: { entity: NodeEntityForDetails; project: ProjectDocument; onAddAttachmentFile: DetailsDrawerProps['onAddAttachmentFile']; onRemoveAttachment: DetailsDrawerProps['onRemoveAttachment'] }): React.JSX.Element {
  const { node } = entity
  const nodeType = project.nodeTypes.find((type) => type.id === node.typeId)
  return (
    <div className="drawer-form">
      <label htmlFor="drawer-title">Title</label>
      <input id="drawer-title" defaultValue={node.title} onBlur={(event) => useProjectStore.getState().updateNode(node.id, { title: event.target.value || 'Untitled node' })} />
      <label htmlFor="drawer-description">Description</label>
      <textarea id="drawer-description" defaultValue={node.description} onBlur={(event) => useProjectStore.getState().updateNode(node.id, { description: event.target.value })} />
      <label htmlFor="drawer-tags">Tags (comma separated)</label>
      <input id="drawer-tags" defaultValue={node.tags.join(', ')} onBlur={(event) => useProjectStore.getState().updateNode(node.id, { tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) })} />
      {nodeType && nodeType.fields.length > 0 && <FieldEditor node={node} fields={nodeType.fields} />}
      <KeyValueEditor nodeId={node.id} properties={node.properties} fieldIds={new Set((nodeType?.fields ?? []).map((field) => field.id))} />
      <section className="drawer-section" aria-label="Associated notes">
        <h3>Notes</h3>
        <ul className="drawer-note-list">
          {entity.noteIds.map((id) => {
            const note = project.notes.find((item) => item.id === id)
            if (!note) return null
            return <li key={id}><button type="button" onClick={() => { useEditorStore.getState().setSelectedIds([id]) }}>{note.title}</button></li>
          })}
        </ul>
        <button type="button" onClick={() => useProjectStore.getState().addNote({ kind: 'node', id: node.id })}>Add note</button>
      </section>
      <section className="drawer-section" aria-label="Attachments">
        <h3>Attachments</h3>
        <ul className="drawer-attachment-list">
          {entity.attachments.map((attachment) => (
            <li key={attachment.id}>
              <span>{attachment.name} <small>{attachment.location.kind === 'url' ? 'link' : `${Math.round(attachment.size / 1024)} KiB`}</small></span>
              {attachment.location.kind === 'url'
                ? <a href={attachment.location.reference} target="_blank" rel="noreferrer">Open</a>
                : <button type="button" className="danger" onClick={() => onRemoveAttachment(attachment.id)}>Remove</button>}
            </li>
          ))}
        </ul>
        <input id="drawer-attachment-file" className="visually-hidden" type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) onAddAttachmentFile(file, [{ kind: 'node', id: node.id }]); event.currentTarget.value = '' }} />
        <label className="drawer-attachment-add" htmlFor="drawer-attachment-file">Add file…</label>
      </section>
    </div>
  )
}

function FieldEditor({ node, fields }: { node: NodeEntity; fields: FieldDefinition[] }): React.JSX.Element {
  return (
    <section className="drawer-section" aria-label="Type fields">
      <h3>Fields</h3>
      {fields.map((field) => {
        const value = node.properties[field.id]
        const inputId = `drawer-field-${field.id}`
        const setValue = (next: unknown) => useProjectStore.getState().updateNode(node.id, { properties: { ...node.properties, [field.id]: next } })
        return (
          <div key={field.id} className="drawer-field">
            <label htmlFor={inputId}>{field.name}{field.required ? ' *' : ''}</label>
            {field.kind === 'boolean' ? (
              <input id={inputId} type="checkbox" checked={Boolean(value)} onChange={(event) => setValue(event.target.checked)} />
            ) : field.kind === 'number' ? (
              <input id={inputId} type="number" defaultValue={typeof value === 'number' ? value : ''} onBlur={(event) => setValue(event.target.value === '' ? undefined : Number(event.target.value))} />
            ) : field.kind === 'select' ? (
              <select id={inputId} defaultValue={typeof value === 'string' ? value : ''} onChange={(event) => setValue(event.target.value)}>
                <option value="" disabled>Select…</option>
                {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            ) : field.kind === 'url' ? (
              <input id={inputId} type="url" defaultValue={typeof value === 'string' ? value : ''} onBlur={(event) => setValue(event.target.value)} />
            ) : (
              <input id={inputId} type="text" defaultValue={typeof value === 'string' ? value : ''} onBlur={(event) => setValue(event.target.value)} />
            )}
          </div>
        )
      })}
    </section>
  )
}

function KeyValueEditor({ nodeId, properties, fieldIds }: { nodeId: string; properties: NodeEntity['properties']; fieldIds: Set<string> }): React.JSX.Element {
  const entries = Object.entries(properties).filter(([key]) => !fieldIds.has(key))
  const [draftKey, setDraftKey] = useState('')
  const [draftValue, setDraftValue] = useState('')
  const setProperty = (key: string, value: unknown) => useProjectStore.getState().updateNode(nodeId, { properties: { ...properties, [key]: value } })
  const removeProperty = (key: string) => {
    const { [key]: _removed, ...rest } = properties
    useProjectStore.getState().updateNode(nodeId, { properties: rest })
  }
  return (
    <section className="drawer-section" aria-label="Custom properties">
      <h3>Properties</h3>
      <ul className="drawer-kv-list">
        {entries.map(([key, value]) => (
          <li key={key} className="drawer-kv-row">
            <span className="drawer-kv-key">{key}</span>
            <input aria-label={`Value for ${key}`} defaultValue={typeof value === 'string' ? value : JSON.stringify(value)} onBlur={(event) => setProperty(key, event.target.value)} />
            <button type="button" className="danger" aria-label={`Remove ${key}`} onClick={() => removeProperty(key)}>Remove</button>
          </li>
        ))}
      </ul>
      <div className="drawer-kv-add">
        <input aria-label="New property name" placeholder="Key" value={draftKey} onChange={(event) => setDraftKey(event.target.value)} />
        <input aria-label="New property value" placeholder="Value" value={draftValue} onChange={(event) => setDraftValue(event.target.value)} />
        <button type="button" disabled={!draftKey.trim()} onClick={() => { setProperty(draftKey.trim(), draftValue); setDraftKey(''); setDraftValue('') }}>Add</button>
      </div>
    </section>
  )
}

function ConnectionDetails({ connection }: { connection: ConnectionEntity }): React.JSX.Element {
  return (
    <div className="drawer-form">
      <label htmlFor="drawer-connection-label">Label</label>
      <input id="drawer-connection-label" defaultValue={connection.label} onBlur={(event) => useProjectStore.getState().updateConnection(connection.id, { label: event.target.value })} />
      <label htmlFor="drawer-connection-relation">Relation</label>
      <input id="drawer-connection-relation" defaultValue={connection.relation} onBlur={(event) => useProjectStore.getState().updateConnection(connection.id, { relation: event.target.value || 'connects to' })} />
      <KeyValueEditor nodeId={connection.id} properties={connection.properties} fieldIds={new Set()} />
    </div>
  )
}

function NoteDetails({ note }: { note: NoteEntity }): React.JSX.Element {
  return (
    <div className="drawer-form">
      <label htmlFor="drawer-note-title">Title</label>
      <input id="drawer-note-title" defaultValue={note.title} onBlur={(event) => useProjectStore.getState().updateNote(note.id, { title: event.target.value || 'Untitled note' })} />
      <label htmlFor="drawer-note-category">Category</label>
      <select id="drawer-note-category" defaultValue={note.category} onChange={(event) => useProjectStore.getState().updateNote(note.id, { category: event.target.value as NoteEntity['category'] })}>
        {(['general', 'decision', 'requirement', 'documentation', 'prompt'] as const).map((category) => <option key={category} value={category}>{category}</option>)}
      </select>
      <label htmlFor="drawer-note-markdown">Markdown</label>
      <textarea id="drawer-note-markdown" defaultValue={note.markdown} onBlur={(event) => useProjectStore.getState().updateNote(note.id, { markdown: event.target.value })} />
      <div className="drawer-note-preview" dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(note.markdown) }} />
    </div>
  )
}

type GroupEntityForDetails = Extract<DrawerEntity, { kind: 'group' }>

function GroupDetails({ entity, project }: { entity: GroupEntityForDetails; project: ProjectDocument }): React.JSX.Element {
  const { group } = entity
  return (
    <div className="drawer-form">
      <label htmlFor="drawer-group-title">Title</label>
      <input id="drawer-group-title" defaultValue={group.title} onBlur={(event) => useProjectStore.getState().updateGroup(group.id, { title: event.target.value || 'Untitled group' })} />
      <label htmlFor="drawer-group-color">Color</label>
      <input id="drawer-group-color" type="color" defaultValue={group.color} onChange={(event) => useProjectStore.getState().updateGroup(group.id, { color: event.target.value })} />
      <section className="drawer-section" aria-label="Associated notes">
        <h3>Notes</h3>
        <ul className="drawer-note-list">
          {entity.noteIds.map((id) => {
            const note = project.notes.find((item) => item.id === id)
            if (!note) return null
            return <li key={id}><button type="button" onClick={() => { useEditorStore.getState().setSelectedIds([id]) }}>{note.title}</button></li>
          })}
        </ul>
        <button type="button" onClick={() => useProjectStore.getState().addNote({ kind: 'group', id: group.id })}>Add note</button>
      </section>
    </div>
  )
}
