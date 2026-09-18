import { useEffect, useRef } from 'react'

export function useDialogFocus(onClose: () => void): React.RefObject<HTMLDivElement | null> {
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const previous = document.activeElement
    const root = panel.current
    root?.querySelector<HTMLElement>('input, textarea, select, button')?.focus()
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); return }
      if (event.key !== 'Tab') return
      const items = Array.from(root?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]') ?? [])
      const first = items[0]
      const last = items.at(-1)
      if (!first) { event.preventDefault(); root?.focus(); return }
      if (event.shiftKey && (document.activeElement === first || !root?.contains(document.activeElement))) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && (document.activeElement === last || !root?.contains(document.activeElement))) { event.preventDefault(); first.focus() }
    }
    root?.addEventListener('keydown', onKeyDown)
    return () => { root?.removeEventListener('keydown', onKeyDown); if (previous instanceof HTMLElement && previous.isConnected) previous.focus() }
  }, [])
  return panel
}
