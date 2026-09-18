import { useState } from 'react'
import { projectTemplates, type ProjectTemplateId } from '../../templates/projectTemplates'
import type { ProjectSummary } from '../../store/project-store'
import { NodeIcon } from './NodeIcon'
import { relativeDate } from './RelativeDate'

type WelcomeProps = {
  projects: ProjectSummary[]
  onCreateProject: (name: string, templateId: ProjectTemplateId) => void
  onOpenProject: (id: string) => void
}

export function Welcome({ projects, onCreateProject, onOpenProject }: WelcomeProps): React.JSX.Element {
  const [newName, setNewName] = useState('Untitled project')
  const [templateId, setTemplateId] = useState<ProjectTemplateId>('blank')
  return (
    <main className="welcome" aria-label="Project chooser">
      <div>
        <div className="brand">
          <span className="brand-mark">◈</span>
          <span>Mind Map</span>
        </div>
        <h1>Start a local project</h1>
        <p>Create a project to begin mapping ideas. Your work stays in this browser.</p>
        <form onSubmit={(event) => { event.preventDefault(); onCreateProject(newName, templateId) }}>
          <label htmlFor="new-project-name">Project name</label>
          <input id="new-project-name" value={newName} onChange={(event) => setNewName(event.target.value)} />
          <label id="template-label">Template</label>
          <div className="template-cards" role="radiogroup" aria-labelledby="template-label">
            {projectTemplates.map((template) => (
              <button
                key={template.id}
                type="button"
                role="radio"
                aria-checked={template.id === templateId}
                aria-pressed={template.id === templateId}
                className="template-card"
                onClick={() => setTemplateId(template.id)}
              >
                <span className="template-card-icons">
                  {template.nodeTypes.slice(0, 4).map((type, index) => (
                    <span key={`${type.name}-${index}`} style={{ color: type.color, backgroundColor: `${type.color}22` }}><NodeIcon name={type.icon} size={12} /></span>
                  ))}
                </span>
                <strong>{template.name}</strong>
                <small>{template.description}</small>
              </button>
            ))}
          </div>
          <button type="submit">Create project</button>
        </form>
        {projects.length > 0 && (
          <div className="project-list">
            <h2>Recent projects</h2>
            {projects.map((item) => (
              <button key={item.id} type="button" onClick={() => onOpenProject(item.id)}>
                <span>{item.name}</span>
                <small>{relativeDate(item.updatedAt)}</small>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
