import { useEffect, useRef, useState } from 'react'
import { FolderOpen, Trash2, ExternalLink, Copy, Check } from 'lucide-react'
import type { DirEntry } from '../state/types'
import { openInFinder } from '../hooks/useTauri'

type ContextMenuProps = {
  x: number
  y: number
  entry: DirEntry
  onClose: () => void
  onNavigate: () => void
  onTrash: () => void
}

export function ContextMenu({ x, y, entry, onClose, onNavigate, onTrash }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    // Use capture to intercept before other handlers
    window.addEventListener('mousedown', handleClick)
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('mousedown', handleClick)
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [onClose])

  // Adjust position so menu doesn't overflow the viewport
  useEffect(() => {
    if (!menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    const el = menuRef.current
    if (rect.right > window.innerWidth) {
      el.style.left = `${x - rect.width}px`
    }
    if (rect.bottom > window.innerHeight) {
      el.style.top = `${y - rect.height}px`
    }
  }, [x, y])

  function handleCopyPath() {
    navigator.clipboard.writeText(entry.path)
    setCopied(true)
    setTimeout(onClose, 600)
  }

  function handleReveal() {
    openInFinder(entry.path)
    onClose()
  }

  function handleOpen() {
    onNavigate()
    onClose()
  }

  function handleTrash() {
    onTrash()
    onClose()
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-2xl py-1 min-w-48 context-menu-enter"
      style={{ left: x, top: y }}
    >
      {entry.is_dir && (
        <>
          <button
            onClick={handleOpen}
            className="flex items-center w-full px-3 py-1.5 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-accent)] hover:text-white transition-colors cursor-pointer gap-2"
          >
            <FolderOpen size={13} />
            <span className="flex-1 text-left">Open</span>
            <span className="text-[10px] text-[var(--color-text-tertiary)] ml-auto">Double-click</span>
          </button>
          <div className="h-px bg-[var(--color-border)] my-1" />
        </>
      )}

      <button
        onClick={handleTrash}
        className="flex items-center w-full px-3 py-1.5 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-accent)] hover:text-white transition-colors cursor-pointer gap-2"
      >
        <Trash2 size={13} />
        <span className="flex-1 text-left">Move to Trash</span>
        <span className="text-[10px] text-[var(--color-text-tertiary)] ml-auto">{'\u2318\u232B'}</span>
      </button>

      <div className="h-px bg-[var(--color-border)] my-1" />

      <button
        onClick={handleReveal}
        className="flex items-center w-full px-3 py-1.5 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-accent)] hover:text-white transition-colors cursor-pointer gap-2"
      >
        <ExternalLink size={13} />
        <span className="flex-1 text-left">Reveal in Finder</span>
      </button>

      <button
        onClick={handleCopyPath}
        className="flex items-center w-full px-3 py-1.5 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-accent)] hover:text-white transition-colors cursor-pointer gap-2"
      >
        {copied ? <Check size={13} className="text-[var(--color-success)]" /> : <Copy size={13} />}
        <span className="flex-1 text-left">{copied ? 'Copied!' : 'Copy Path'}</span>
      </button>
    </div>
  )
}
