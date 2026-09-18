import type { LucideIcon } from 'lucide-react'
import { Archive, ArrowLeftRight, Database, Diamond, Globe, Layers, Monitor, Network, Router, Server, Shield, Split, Zap } from 'lucide-react'

const icons: Record<string, LucideIcon> = {
  'arrow-left-right': ArrowLeftRight,
  archive: Archive,
  database: Database,
  diamond: Diamond,
  globe: Globe,
  layers: Layers,
  monitor: Monitor,
  network: Network,
  router: Router,
  server: Server,
  shield: Shield,
  split: Split,
  zap: Zap,
}

export function NodeIcon({ name, size = 14 }: { name: string; size?: number }): React.JSX.Element {
  const Resolved = icons[name]
  return Resolved ? <Resolved size={size} aria-hidden="true" /> : <span aria-hidden="true">{name}</span>
}
