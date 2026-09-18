import { useDialogFocus } from '../hooks/useDialogFocus'

export type ConfirmRequest = { title: string; description?: string; confirmLabel: string; danger?: boolean; onConfirm: () => void }

export function ConfirmDialog({ request, onCancel }: { request: ConfirmRequest; onCancel: () => void }): React.JSX.Element {
  const panel = useDialogFocus(onCancel)
  return (
    <div className="palette-backdrop" role="presentation" onMouseDown={onCancel}>
      <div ref={panel} role="alertdialog" aria-modal="true" aria-label={request.title} aria-describedby="confirmation-description" className="confirm-dialog" tabIndex={-1} onMouseDown={(event) => event.stopPropagation()}>
        <h2>{request.title}</h2>
        <p id="confirmation-description">{request.description ?? 'Confirm this action.'}</p>
        <div className="confirm-actions">
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="button" className={request.danger ? 'danger' : ''} onClick={() => { onCancel(); request.onConfirm() }}>{request.confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
