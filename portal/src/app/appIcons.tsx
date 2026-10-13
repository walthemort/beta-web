/** Each app's icon and colours – its tile, like on a phone's home screen. Used by the apps page and the sidebar. */
import { BotMessageSquare, Box, CalendarHeart, PanelsTopLeft, Presentation, ScanSearch, WandSparkles, type LucideIcon } from 'lucide-react'
import type { AppId } from '../data/types'

export const APP_ICONS: Record<AppId, LucideIcon> = {
  contentMachine: WandSparkles,
  mockups: Box,
  presenter: Presentation,
  socialPlanner: CalendarHeart,
  pages: PanelsTopLeft,
  assistant: BotMessageSquare,
  audit: ScanSearch,
}

/** Each app's own colours – its icon tile, like on a phone's home screen. */
export const APP_COLOURS: Record<AppId, [string, string]> = {
  contentMachine: ['#3d5afe', '#2340d1'],
  mockups: ['#ff8a5c', '#e0623c'],
  presenter: ['#f6b73c', '#e08a1e'],
  socialPlanner: ['#f06292', '#c2185b'],
  pages: ['#26b69a', '#12806d'],
  assistant: ['#9c7cf4', '#6a45d8'],
  audit: ['#4a5563', '#1f2630'],
}

/** An app's icon: its symbol on a rounded tile in the app's colours. */
export function AppIcon({ id, size = 56 }: { id: AppId; size?: number }) {
  const Icon = APP_ICONS[id]
  const [a, b] = APP_COLOURS[id]
  return (
    <span className="app-tile" style={{ width: size, height: size, borderRadius: size * 0.24, background: `linear-gradient(145deg, ${a}, ${b})` }}>
      <Icon size={Math.round(size * 0.46)} strokeWidth={1.8} />
    </span>
  )
}
