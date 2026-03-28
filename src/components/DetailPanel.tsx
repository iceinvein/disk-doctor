import { useState } from 'react'
import { Folder, File, Link, Lock, Trash2, ExternalLink } from 'lucide-react'
import { useStore } from '../state/store'
import { findEntry, getCurrentNode, formatSize, formatDate } from '../state/helpers'
import { useTrash, openInFinder } from '../hooks/useTauri'
import { ConfirmDialog } from './ConfirmDialog'

export function DetailPanel() {
  const activePath = useStore(s => s.activePath)
  const tree = useStore(s => s.tree)
  const currentPath = useStore(s => s.currentPath)
  const { trashItems } = useTrash()
  const [showConfirm, setShowConfirm] = useState(false)
  const [trashError, setTrashError] = useState<string | null>(null)

  const entry = activePath ? findEntry(tree, activePath) : null
  const parentNode = getCurrentNode(tree, currentPath)
  const parentSize = parentNode?.size ?? 0
  const percentOfParent = entry && parentSize > 0 ? ((entry.size / parentSize) * 100).toFixed(1) : null

  async function handleTrash() {
    if (!entry) return
    setShowConfirm(false)
    setTrashError(null)
    const failed = await trashItems([entry.path])
    if (failed.length > 0) setTrashError(`Failed to trash: ${entry.name}`)
  }

  if (!entry) {
    return (
      <div className="w-72 border-l border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex items-center justify-center p-6 shrink-0">
        <p className="text-sm text-[var(--color-text-tertiary)] text-center">
          Select an item to view details
        </p>
      </div>
    )
  }

  const IconComponent = entry.is_symlink ? Link : entry.is_restricted ? Lock : entry.is_dir ? Folder : File

  return (
    <div className="w-72 border-l border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex flex-col p-5 shrink-0 overflow-y-auto fade-in" key={entry.path}>
      {/* Icon and name */}
      <div className="flex flex-col items-center mb-5 pt-2">
        <div className="w-14 h-14 rounded-2xl bg-[var(--color-bg-hover)] flex items-center justify-center mb-3">
          <IconComponent size={28} className="text-[var(--color-accent)]" />
        </div>
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)] text-center break-all leading-snug">
          {entry.name}
        </h2>
        <p className="text-xl font-bold text-[var(--color-text-primary)] mt-1.5 tabular-nums">
          {formatSize(entry.size)}
        </p>
      </div>

      {/* Metadata */}
      <div className="rounded-lg bg-[var(--color-bg-primary)] p-3 mb-5">
        <div className="flex flex-col gap-2.5 text-xs">
          {entry.is_dir && (
            <div className="flex justify-between">
              <span className="text-[var(--color-text-tertiary)]">Items</span>
              <span className="text-[var(--color-text-primary)] tabular-nums">{entry.child_count.toLocaleString()}</span>
            </div>
          )}
          {entry.modified > 0 && (
            <div className="flex justify-between">
              <span className="text-[var(--color-text-tertiary)]">Modified</span>
              <span className="text-[var(--color-text-primary)]">{formatDate(entry.modified)}</span>
            </div>
          )}
          {percentOfParent !== null && (
            <div className="flex justify-between">
              <span className="text-[var(--color-text-tertiary)]">% of parent</span>
              <span className="text-[var(--color-text-primary)] tabular-nums">{percentOfParent}%</span>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <span className="text-[var(--color-text-tertiary)] shrink-0">Path</span>
            <span className="text-[var(--color-text-primary)] truncate text-right" title={entry.path}>{entry.path}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 mt-auto">
        <button
          onClick={() => setShowConfirm(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--color-danger)] text-white text-sm font-medium hover:brightness-110 transition-all cursor-pointer"
        >
          <Trash2 size={14} />
          Move to Trash
        </button>
        <button
          onClick={() => entry && openInFinder(entry.path)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] text-sm border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
        >
          <ExternalLink size={14} />
          Reveal in Finder
        </button>
      </div>

      {trashError && (
        <div className="mt-3 px-3 py-2 rounded-lg bg-[var(--color-danger-bg)] border border-[var(--color-danger)]/20 text-[var(--color-danger)] text-xs text-center">
          {trashError}
        </div>
      )}

      {showConfirm && (
        <ConfirmDialog
          title="Move to Trash"
          message={`"${entry.name}" (${formatSize(entry.size)}) will be moved to the Trash. You can recover it from the Trash later.`}
          confirmLabel="Move to Trash"
          onConfirm={handleTrash}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  )
}
