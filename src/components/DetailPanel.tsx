import { useState } from 'react'
import { useAppState } from '../state/context'
import { findEntry, getCurrentNode, formatSize, formatDate } from '../state/helpers'
import { useTrash, openInFinder } from '../hooks/useTauri'
import { ConfirmDialog } from './ConfirmDialog'

export function DetailPanel() {
  const { state } = useAppState()
  const { trashItems } = useTrash()
  const [showConfirm, setShowConfirm] = useState(false)
  const [trashError, setTrashError] = useState<string | null>(null)

  const entry = state.activePath
    ? findEntry(state.tree, state.activePath)
    : null

  const parentNode = getCurrentNode(state.tree, state.currentPath)
  const parentSize = parentNode?.size ?? 0
  const percentOfParent =
    entry && parentSize > 0
      ? ((entry.size / parentSize) * 100).toFixed(1)
      : null

  async function handleTrash() {
    if (!entry) return
    setShowConfirm(false)
    setTrashError(null)

    const failed = await trashItems([entry.path])
    if (failed.length > 0) {
      setTrashError(`Failed to trash: ${entry.name}`)
    }
  }

  async function handleReveal() {
    if (!entry) return
    try {
      await openInFinder(entry.path)
    } catch {
      // Ignore finder errors
    }
  }

  if (!entry) {
    return (
      <div className="w-72 border-l border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex items-center justify-center p-6 shrink-0">
        <p className="text-sm text-[var(--color-text-secondary)] text-center">
          Select a file or folder to see details
        </p>
      </div>
    )
  }

  // Determine icon (same logic as FileRow but inline for the large display)
  let icon = '📄'
  if (entry.is_symlink) icon = '🔗'
  else if (entry.is_restricted) icon = '🔒'
  else if (entry.is_dir) icon = '📁'

  return (
    <div className="w-72 border-l border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex flex-col p-6 shrink-0 overflow-y-auto">
      {/* Large icon and name */}
      <div className="flex flex-col items-center mb-6">
        <span className="text-5xl mb-3" role="img" aria-hidden="true">
          {icon}
        </span>
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)] text-center break-all">
          {entry.name}
        </h2>
        <p className="text-lg font-bold text-[var(--color-text-primary)] mt-1">
          {formatSize(entry.size)}
        </p>
      </div>

      {/* Metadata */}
      <div className="flex flex-col gap-3 mb-6">
        {entry.is_dir && (
          <div className="flex justify-between text-xs">
            <span className="text-[var(--color-text-secondary)]">Items</span>
            <span className="text-[var(--color-text-primary)]">
              {entry.child_count.toLocaleString()}
            </span>
          </div>
        )}

        {entry.modified > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-[var(--color-text-secondary)]">Modified</span>
            <span className="text-[var(--color-text-primary)]">
              {formatDate(entry.modified)}
            </span>
          </div>
        )}

        {percentOfParent !== null && (
          <div className="flex justify-between text-xs">
            <span className="text-[var(--color-text-secondary)]">% of parent</span>
            <span className="text-[var(--color-text-primary)]">
              {percentOfParent}%
            </span>
          </div>
        )}

        <div className="flex justify-between text-xs gap-2">
          <span className="text-[var(--color-text-secondary)] shrink-0">Path</span>
          <span className="text-[var(--color-text-primary)] truncate text-right">
            {entry.path}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 mt-auto">
        <button
          onClick={() => setShowConfirm(true)}
          className="px-4 py-2 rounded-lg bg-[var(--color-danger)] text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
        >
          Move to Trash
        </button>

        <button
          onClick={handleReveal}
          className="px-4 py-2 rounded-lg bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] text-sm border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
        >
          Reveal in Finder
        </button>
      </div>

      {/* Error display */}
      {trashError && (
        <div className="mt-3 px-3 py-2 rounded-lg bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 text-[var(--color-danger)] text-xs text-center">
          {trashError}
        </div>
      )}

      {/* Confirmation dialog */}
      {showConfirm && (
        <ConfirmDialog
          title="Move to Trash"
          message={`Are you sure you want to move "${entry.name}" to the trash?`}
          confirmLabel="Move to Trash"
          onConfirm={handleTrash}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  )
}
