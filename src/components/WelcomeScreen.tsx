import { useScan } from '../hooks/useTauri'
import { useAppState } from '../state/context'

export function WelcomeScreen() {
  const { scanFolder, scanEntireDisk } = useScan()
  const { state } = useAppState()

  return (
    <div className="flex flex-col items-center justify-center flex-1">
      <div className="text-7xl mb-6" role="img" aria-label="Disk Doctor">
        💊
      </div>

      <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
        Disk Doctor
      </h1>

      <p className="text-[var(--color-text-secondary)] mb-8">
        Analyze disk usage and reclaim space
      </p>

      <div className="flex gap-4 mb-6">
        <button
          onClick={scanFolder}
          className="px-6 py-3 rounded-lg bg-[var(--color-accent)] text-white font-medium hover:opacity-90 transition-opacity cursor-pointer"
        >
          Choose Folder
        </button>

        <button
          onClick={scanEntireDisk}
          className="px-6 py-3 rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] font-medium border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
        >
          Scan Entire Disk
        </button>
      </div>

      <p className="text-xs text-[var(--color-text-secondary)] max-w-md text-center">
        Scanning the entire disk requires Full Disk Access. Go to System
        Settings &gt; Privacy &amp; Security &gt; Full Disk Access to grant
        permission.
      </p>

      {state.error && (
        <div className="mt-4 px-4 py-3 rounded-lg bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 text-[var(--color-danger)] text-sm max-w-md text-center">
          {state.error}
        </div>
      )}
    </div>
  )
}
