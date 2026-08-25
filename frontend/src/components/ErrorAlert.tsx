type ErrorAlertProps = {
  message: string
  onRetry?: () => void
  onDismiss?: () => void
}

export default function ErrorAlert({
  message,
  onRetry,
  onDismiss,
}: ErrorAlertProps) {
  return (
    <div
      role="alert"
      className="mx-auto flex w-full max-w-[560px] items-center justify-between gap-4 rounded-md border border-red/25 bg-red/5 px-3 py-2.5 text-[13px] text-red"
    >
      <span>{message}</span>
      <div className="flex shrink-0 items-center gap-2">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="cursor-pointer rounded border border-red/30 px-2 py-1 font-mono text-[9px] tracking-[0.08em] uppercase"
          >
            Retry
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="cursor-pointer px-1 text-lg leading-none"
            aria-label="Dismiss error"
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}
