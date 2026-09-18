import { useEffect, useRef, useState } from 'react'

export type MenuItem = { id: string; label: string; onSelect: () => void; danger?: boolean; disabled?: boolean }

export function Menu({ label, items, ariaLabel, align = 'left' }: { label: React.ReactNode; items: MenuItem[]; ariaLabel: string; align?: 'left' | 'right' }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent): void => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    const onKeyDown = (event: KeyboardEvent): void => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => { window.removeEventListener('pointerdown', onPointerDown); window.removeEventListener('keydown', onKeyDown) }
  }, [open])
  return (
    <div className="menu" ref={root}>
      <button type="button" aria-label={ariaLabel} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((value) => !value)}>{label}</button>
      {open && (
        <div className={`menu-list menu-${align}`} role="menu" aria-label={ariaLabel}>
          {items.map((item) => (
            <button key={item.id} type="button" role="menuitem" className={item.danger ? 'danger' : ''} disabled={item.disabled} onClick={() => { setOpen(false); item.onSelect() }}>{item.label}</button>
          ))}
        </div>
      )}
    </div>
  )
}
