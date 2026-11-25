import type { CodiconName } from '@tensorai-co/workspace/icons'
import { Codicon } from '@tensorai-co/workspace/icons/react'

/** A button for the right end of a tab bar. */
export function TabAction({ icon, label, onClick }: { icon: CodiconName; label: string; onClick: () => void }) {
  return (
    <button type="button" className="ws-tab-action" title={label} aria-label={label} onClick={onClick}>
      <Codicon name={icon} />
    </button>
  )
}
