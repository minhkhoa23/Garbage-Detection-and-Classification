type ProcessingPanelProps = {
  imageUrl: string
  progress: number
  onCancel: () => void
}

export default function ProcessingPanel({
  imageUrl,
  progress,
  onCancel,
}: ProcessingPanelProps) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-8">
      <div className="w-full max-w-[560px]">
        <div className="relative mb-7 aspect-video w-full overflow-hidden rounded-lg bg-surface">
          <img
            src={imageUrl}
            alt="Image being analyzed"
            className="size-full object-contain opacity-50 grayscale-[0.4]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_40%,#f4f7f530)]" />
          <div
            className="absolute right-0 left-0 h-0.5 bg-[linear-gradient(90deg,transparent,var(--color-green-dim),transparent)] transition-[top] duration-100"
            style={{ top: `${progress}%` }}
          />
        </div>

        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-[0.1em] text-text-muted">
            ANALYZING IMAGE
          </span>
          <span className="font-mono text-[11px] text-green-dim">
            {Math.round(progress)}%
          </span>
        </div>

        <div className="h-0.5 w-full rounded-sm bg-border">
          <div
            className="h-full rounded-sm bg-green-dim transition-[width] duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="font-mono text-[9px] tracking-[0.08em] text-text-dim">
            Waiting for backend response...
          </span>
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer rounded border border-border px-2 py-1 font-mono text-[9px] tracking-[0.08em] text-text-muted uppercase transition hover:border-border-bright hover:text-text"
          >
            Cancel
          </button>
        </div>
      </div>
    </section>
  )
}
