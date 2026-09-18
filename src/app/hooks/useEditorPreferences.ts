import { useEffect, useState } from 'react'

export function useEditorPreferences(): boolean {
  const [smallViewport, setSmallViewport] = useState(() => window.innerWidth < 760)
  useEffect(() => {
    const onResize = (): void => setSmallViewport(window.innerWidth < 760)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return smallViewport
}
