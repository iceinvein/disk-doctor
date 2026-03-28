import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

type HintProps = {
  id: string
  children: React.ReactNode
  delay?: number
}

/**
 * Contextual hint that appears once, then never again.
 * Tracks dismissal in localStorage so it survives app restarts.
 */
export function Hint({ id, children, delay = 1000 }: HintProps) {
  const key = `hint-seen-${id}`
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(key)) return
    const timer = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(timer)
  }, [key, delay])

  function dismiss() {
    setVisible(false)
    localStorage.setItem(key, '1')
  }

  if (!visible) return null

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
