import { useEffect, useState } from 'react'
import { getDiskUsage } from '../hooks/useTauri'
import { useStore } from '../state/store'
import { formatSize } from '../state/helpers'

export function DiskUsageBar() {
  const tree = useStore(s => s.tree)
  const [usage, setUsage] = useState<{ total: number; used: number; free: number } | null>(null)

  useEffect(() => {
    if (!tree) return
    getDiskUsage(tree.path).then(setUsage).catch(() => {})
  }, [tree])

  if (!usage) return null

  const usedPercent = (usage.used / usage.total) * 100
  const scannedPercent = tree ? (tree.size / usage.total) * 100 : 0

  return (
    <div className="px-3 py-2 bg-[var(--color-bg-tertiary)] border-b border-[var(--color-border)] shrink-0">
      {/* Usage bar */}
      <div className="h-2 rounded-full bg-[var(--color-bg-primary)] overflow-hidden mb-1.5">
        <div className="h-full flex">
          <div
            className="bg-[var(--color-accent)] transition-all duration-500"
            style={{ width: `${scannedPercent}%` }}
            title={`Scanned: ${tree ? formatSize(tree.size) : ''}`}
          />
          <div
            className="bg-[var(--color-text-tertiary)] opacity-30 transition-all duration-500"
            style={{ width: `${Math.max(0, usedPercent - scannedPercent)}%` }}
            title={`Other used: ${formatSize(usage.used - (tree?.size ?? 0))}`}
          />
        </div>
      </div>

      {/* Labels */}
      <div className="flex justify-between text-[10px] text-[var(--color-text-tertiary)]">
        <span>{formatSize(usage.used)} used of {formatSize(usage.total)}</span>
        <span>{formatSize(usage.free)} available</span>
      </div>
    </div>
  )
}
