import { useState, useEffect } from 'react'
import { X, Info } from 'lucide-react'

type HintProps = {
  id: string
  children: React.ReactNode
  delay?: number
  rediscoverable?: boolean
}

/**
 * Contextual hint that appears once, then never again.
 * Tracks dismissal in localStorage so it survives app restarts.
 * When rediscoverable is true (default), a small "i" icon remains after dismissal
 * so the user can temporarily re-expand the hint.
 */
export function Hint({ id, children, delay = 1000, rediscoverable = true }: HintProps) {
  const key = `hint-seen-${id}`
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [rediscovered, setRediscovered] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(key)) {
      setDismissed(true)
      return
    }
    const timer = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(timer)
  }, [key, delay])

  function dismiss() {
    setVisible(false)
    setRediscovered(false)
    setDismissed(true)
    localStorage.setItem(key, '1')
  }

  // Dismissed and not being temporarily re-shown — render the collapsed indicator
  if (dismissed && !rediscovered) {
    if (!rediscoverable) return null
    return (
      <button
        onClick={() => setRediscovered(true)}
        className="opacity-50 hover:opacity-100 transition-opacity cursor-pointer"
        aria-label="Show hint"
      >
        <Info size={12} className="text-[var(--color-text-tertiary)]" />
      </button>
    )
  }

  // Not yet visible (initial delay hasn't elapsed)
  if (!visible && !rediscovered) return null

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 text-xs text-[var(--color-accent)] fade-in">
      <span className="flex-1">{children}</span>
      <button
        onClick={dismiss}
        className="shrink-0 text-[var(--color-accent)]/50 hover:text-[var(--color-accent)] cursor-pointer transition-colors"
        aria-label="Dismiss hint"
      >
        <X size={12} />
      </button>
    </div>
  )
}
