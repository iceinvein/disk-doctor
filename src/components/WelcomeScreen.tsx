import { FolderSearch, Shield } from 'lucide-react'
import { useScan } from '../hooks/useTauri'

export function WelcomeScreen() {
  const { scanFolder, scanEntireDisk } = useScan()

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-8">
      {/* Disk usage ring illustration */}
      <div className="mb-8">
        <svg viewBox="0 0 120 120" className="w-32 h-32">
          {/* Background ring */}
          <circle cx="60" cy="60" r="50" fill="none" stroke="var(--color-bg-hover)" strokeWidth="16" />
          {/* Segment 1 - folders (blue) */}
          <circle cx="60" cy="60" r="50" fill="none" stroke="var(--color-cat-folder)" strokeWidth="16"
            strokeDasharray="110 204" strokeDashoffset="0" transform="rotate(-90 60 60)" opacity="0.85" />
          {/* Segment 2 - media (orange) */}
          <circle cx="60" cy="60" r="50" fill="none" stroke="var(--color-cat-media)" strokeWidth="16"
            strokeDasharray="60 254" strokeDashoffset="-110" transform="rotate(-90 60 60)" opacity="0.85" />
          {/* Segment 3 - code (green) */}
          <circle cx="60" cy="60" r="50" fill="none" stroke="var(--color-cat-code)" strokeWidth="16"
            strokeDasharray="40 274" strokeDashoffset="-170" transform="rotate(-90 60 60)" opacity="0.85" />
          {/* Center text */}
          <text x="60" y="56" textAnchor="middle" fill="var(--color-text-primary)" fontSize="16" fontWeight="bold">
            ...
          </text>
          <text x="60" y="72" textAnchor="middle" fill="var(--color-text-secondary)" fontSize="9">
            of storage
          </text>
        </svg>
      </div>

      <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1.5 tracking-tight">
        Disk Doctor
      </h1>
      <p className="text-sm text-[var(--color-text-secondary)] mb-10 max-w-xs text-center leading-relaxed">
        Find what's taking up space and reclaim storage on your Mac
      </p>

      <div className="flex flex-col gap-3 w-72">
        <button
          onClick={scanFolder}
          className="flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-[var(--color-accent)] text-white font-medium text-sm hover:bg-[var(--color-accent-hover)] transition-colors cursor-pointer shadow-md shadow-blue-500/10"
        >
          <FolderSearch size={18} />
          Choose Folder
        </button>

        <button
          onClick={scanEntireDisk}
          className="flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] font-medium text-sm border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
        >
          <Shield size={18} className="text-[var(--color-text-secondary)]" />
          Scan Entire Disk
        </button>
      </div>

      <p className="text-xs text-[var(--color-text-tertiary)] max-w-xs text-center mt-8 leading-relaxed">
        Scanning the entire disk requires Full Disk Access in<br />
        System Settings &rarr; Privacy &amp; Security
      </p>
    </div>
  )
}
