import { HardDrive, FolderSearch, Shield } from 'lucide-react'
import { useScan } from '../hooks/useTauri'
import { useAppState } from '../state/context'

export function WelcomeScreen() {
  const { scanFolder, scanEntireDisk } = useScan()
  const { state } = useAppState()

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-8">
      {/* Disk illustration */}
      <div className="w-24 h-24 rounded-3xl bg-gradient-to-b from-[var(--color-bg-hover)] to-[var(--color-bg-primary)] border border-[var(--color-border)] flex items-center justify-center mb-8 shadow-lg">
        <HardDrive size={44} className="text-[var(--color-accent)]" strokeWidth={1.5} />
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

      {state.error && (
        <div className="mt-4 px-4 py-3 rounded-xl bg-[var(--color-danger-bg)] border border-[var(--color-danger)]/20 text-[var(--color-danger)] text-sm max-w-sm text-center">
          {state.error}
        </div>
      )}
    </div>
  )
}
