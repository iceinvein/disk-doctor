import { useState } from 'react'
import { Shield, Settings, CheckCircle2, RefreshCw, ChevronRight, ArrowLeft } from 'lucide-react'
import { useAppState } from '../state/context'
import { checkFullDiskAccess, openFullDiskAccessSettings } from '../hooks/useTauri'
import { useScan } from '../hooks/useTauri'

export function PermissionGuide() {
  const { dispatch } = useAppState()
  const { scanEntireDisk } = useScan()
  const [checking, setChecking] = useState(false)
  const [granted, setGranted] = useState(false)

  async function handleOpenSettings() {
    await openFullDiskAccessSettings()
  }

  async function handleRecheck() {
    setChecking(true)
    const hasAccess = await checkFullDiskAccess()
    setChecking(false)

    if (hasAccess) {
      setGranted(true)
      // Brief pause to show the success state, then start scanning
      setTimeout(() => {
        dispatch({ type: 'SHOW_PERMISSION_GUIDE', show: false })
        scanEntireDisk()
      }, 800)
    }
  }

  function handleBack() {
    dispatch({ type: 'SHOW_PERMISSION_GUIDE', show: false })
  }

  if (granted) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 px-8 fade-in">
        <div className="w-16 h-16 rounded-2xl bg-[var(--color-success)]/10 flex items-center justify-center mb-5">
          <CheckCircle2 size={32} className="text-[var(--color-success)]" />
        </div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
          Access Granted
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Starting full disk scan…
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-8 fade-in">
      {/* Back button */}
      <button
        onClick={handleBack}
        className="absolute top-16 left-4 flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      {/* Shield icon */}
      <div className="w-20 h-20 rounded-3xl bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/20 flex items-center justify-center mb-6">
        <Shield size={36} className="text-[var(--color-warning)]" />
      </div>

      <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2 tracking-tight">
        Full Disk Access Required
      </h2>
      <p className="text-sm text-[var(--color-text-secondary)] mb-8 max-w-sm text-center leading-relaxed">
        To scan your entire disk, macOS requires you to grant Disk Doctor permission
        to read all files. Your data never leaves your computer.
      </p>

      {/* Steps */}
      <div className="w-full max-w-sm mb-8">
        <div className="flex flex-col gap-0.5">
          {/* Step 1 */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--color-bg-secondary)]">
            <div className="w-6 h-6 rounded-full bg-[var(--color-accent)]/15 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-bold text-[var(--color-accent)]">1</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--color-text-primary)] font-medium">
                Open System Settings
              </p>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                Click the button below to go directly there
              </p>
            </div>
          </div>

          <div className="flex justify-center py-1">
            <ChevronRight size={14} className="text-[var(--color-text-tertiary)] rotate-90" />
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--color-bg-secondary)]">
            <div className="w-6 h-6 rounded-full bg-[var(--color-accent)]/15 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-bold text-[var(--color-accent)]">2</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--color-text-primary)] font-medium">
                Enable Disk Doctor
              </p>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                Find "Disk Doctor" in the list and toggle it on
              </p>
            </div>
          </div>

          <div className="flex justify-center py-1">
            <ChevronRight size={14} className="text-[var(--color-text-tertiary)] rotate-90" />
          </div>

          {/* Step 3 */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--color-bg-secondary)]">
            <div className="w-6 h-6 rounded-full bg-[var(--color-accent)]/15 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-bold text-[var(--color-accent)]">3</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--color-text-primary)] font-medium">
                Come back and re-check
              </p>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                Click "Check Permission" below after granting access
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-3 w-72">
        <button
          onClick={handleOpenSettings}
          className="flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-[var(--color-accent)] text-white font-medium text-sm hover:bg-[var(--color-accent-hover)] transition-colors cursor-pointer shadow-md shadow-blue-500/10"
        >
          <Settings size={18} />
          Open System Settings
        </button>

        <button
          onClick={handleRecheck}
          disabled={checking}
          className="flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] font-medium text-sm border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={18} className={`text-[var(--color-text-secondary)] ${checking ? 'animate-spin' : ''}`} />
          {checking ? 'Checking…' : 'Check Permission'}
        </button>
      </div>
    </div>
  )
}
