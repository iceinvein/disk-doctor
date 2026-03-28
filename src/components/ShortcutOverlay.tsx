import { useEffect, useRef } from 'react'
import { useStore } from '../state/store'

type ShortcutGroup = {
  title: string
  shortcuts: { keys: string; description: string }[]
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: '\u2190 / Backspace', description: 'Go back' },
      { keys: 'Double-click', description: 'Open folder' },
      { keys: 'Escape', description: 'Deselect all' },
    ],
  },
  {
    title: 'Selection',
    shortcuts: [
      { keys: '\u2318A', description: 'Select all' },
      { keys: 'Click', description: 'Select item' },
      { keys: 'Checkbox', description: 'Toggle selection' },
    ],
  },
  {
    title: 'Actions',
    shortcuts: [
      { keys: '\u2318\u232B', description: 'Trash selected' },
      { keys: '\u2318F', description: 'Search / Filter' },
      { keys: '?', description: 'Show shortcuts' },
    ],
  },
]

export function ShortcutOverlay() {
  const showShortcuts = useStore(s => s.showShortcuts)
  const toggleShortcuts = useStore(s => s.toggleShortcuts)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showShortcuts) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' || e.key === '?') {
        e.stopPropagation()
        e.preventDefault()
        toggleShortcuts()
      }
    }
    function handleClick(e: MouseEvent) {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        toggleShortcuts()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('mousedown', handleClick)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('mousedown', handleClick)
    }
  }, [showShortcuts, toggleShortcuts])

  if (!showShortcuts) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 modal-overlay backdrop-blur-sm">
      <div
        ref={overlayRef}
        className="bg-[var(--color-bg-secondary)] rounded-2xl p-6 w-80 border border-[var(--color-border)] shadow-2xl fade-in"
      >
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-4 text-center">
          Keyboard Shortcuts
        </h2>

        <div className="flex flex-col gap-4">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2">
                {group.title}
              </h3>
              <div className="flex flex-col gap-1.5">
                {group.shortcuts.map((shortcut) => (
                  <div key={shortcut.keys} className="flex items-center justify-between">
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {shortcut.description}
                    </span>
                    <kbd className="text-[10px] text-[var(--color-text-tertiary)] bg-[var(--color-bg-primary)] px-1.5 py-0.5 rounded border border-[var(--color-border)] font-mono">
                      {shortcut.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={toggleShortcuts}
          className="mt-5 w-full text-center text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors cursor-pointer"
        >
          Press ? or Esc to close
        </button>
      </div>
    </div>
  )
}
