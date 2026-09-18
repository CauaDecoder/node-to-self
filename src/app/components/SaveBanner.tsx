import type { SaveStatus } from '../../store/project-store'

type SaveBannerProps = {
  saveStatus: SaveStatus
  saveError: string | null
  importError: string | null
  onRetry: () => void
  onReloadSaved: () => void
  onExportBackup: () => void
  onDismissImportError: () => void
}

export function SaveBanner({ saveStatus, saveError, importError, onRetry, onReloadSaved, onExportBackup, onDismissImportError }: SaveBannerProps): React.JSX.Element | null {
  if (importError) {
    return (
      <div className="canvas-banner error" role="alert">
        <span>{importError}</span>
        <div className="canvas-banner-actions">
          <button type="button" onClick={onDismissImportError}>Dismiss</button>
        </div>
      </div>
    )
  }
  if (saveStatus !== 'error' && saveStatus !== 'conflict') return null
  return (
    <div className={`canvas-banner ${saveStatus}`} role="alert">
      <span>{saveError ?? (saveStatus === 'conflict' ? 'This project changed in another tab.' : 'Saving failed.')}</span>
      <div className="canvas-banner-actions">
        <button type="button" onClick={onRetry}>Retry</button>
        <button type="button" onClick={onReloadSaved}>Reload saved version</button>
        <button type="button" onClick={onExportBackup}>Export my changes</button>
      </div>
    </div>
  )
}
