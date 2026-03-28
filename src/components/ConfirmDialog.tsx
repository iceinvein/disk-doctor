import { useEffect, useRef } from 'react'

type ConfirmDialogProps = {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Focus the cancel button on mount
    const cancelBtn = dialogRef.current?.querySelector<HTMLButtonElement>('[data-cancel]')
    cancelBtn?.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCancel()
      }
      // Trap focus within dialog
      if (e.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button')
        if (!focusable || focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [onCancel])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 modal-overlay backdrop-blur-sm">
      <div ref={dialogRef} className="bg-[var(--color-bg-secondary)] rounded-2xl p-6 w-80 border border-[var(--color-border)] shadow-2xl fade-in" role="alertdialog" aria-labelledby="confirm-title" aria-describedby="confirm-message">
        <h2 id="confirm-title" className="text-base font-semibold text-[var(--color-text-primary)] mb-2">
          {title}
        </h2>
        <p id="confirm-message" className="text-sm text-[var(--color-text-secondary)] mb-6 leading-relaxed">
          {message}
        </p>
        <div className="flex justify-end gap-2">
          <button
            data-cancel
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-[var(--color-danger)] text-white text-sm font-medium hover:brightness-110 transition-all cursor-pointer"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
