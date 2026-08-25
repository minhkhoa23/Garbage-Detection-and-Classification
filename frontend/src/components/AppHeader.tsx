import { BACKEND_STATUS_VIEW } from "../config/ui"
import type { BackendStatus } from "../types/ui"

type AppHeaderProps = {
  backendStatus: BackendStatus
  showReset: boolean
  onReset: () => void
}

export default function AppHeader({
  backendStatus,
  showReset,
  onReset,
}: AppHeaderProps) {
  const statusView = BACKEND_STATUS_VIEW[backendStatus]

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-bg px-4 sm:px-8">
      <div className="flex items-center gap-3">
        <div className="relative flex size-7 items-center justify-center rounded-sm border-[1.5px] border-green-dim">
          <div className="size-3 rounded-[2px] border-[1.5px] border-green-dim" />
          <div className="absolute top-[3px] left-[3px] size-1 rounded-full bg-green-dim" />
        </div>
        <span className="font-display text-[15px] font-semibold tracking-[-0.01em] text-text">
          GOD
        </span>
        <span className="hidden font-mono text-[9px] tracking-[0.12em] text-text-dim uppercase sm:inline">
          Garbage Object Detection
        </span>
      </div>

      <div className="flex items-center gap-5">
        <div className="flex items-center gap-1.5">
          <div
            className="size-1.5 rounded-full"
            style={{ background: statusView.color }}
          />
          <span
            className="font-mono text-[10px] tracking-[0.08em]"
            style={{ color: statusView.color }}
          >
            {statusView.label}
          </span>
        </div>

        {showReset && (
          <button
            type="button"
            onClick={onReset}
            className="cursor-pointer rounded-[3px] border border-border bg-transparent px-2.5 py-1 font-mono text-[10px] tracking-[0.08em] text-text-muted transition hover:border-border-bright hover:text-text"
          >
            NEW IMAGE
          </button>
        )}
      </div>
    </header>
  )
}
