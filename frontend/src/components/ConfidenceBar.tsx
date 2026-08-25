import { CONFIDENCE_LEVELS } from "../config/ui"

function confidenceColor(value: number) {
  if (value >= CONFIDENCE_LEVELS.high) return "var(--color-green-dim)"
  if (value >= CONFIDENCE_LEVELS.medium) return "var(--color-amber)"
  return "var(--color-red)"
}

export default function ConfidenceBar({ value }: { value: number }) {
  const percentage = Math.round(value * 100)
  const color = confidenceColor(value)

  return (
    <div className="flex items-center gap-2">
      <div className="h-[3px] w-[72px] overflow-hidden rounded-sm bg-border">
        <div
          className="h-full rounded-sm transition-[width] duration-700"
          style={{ width: `${percentage}%`, background: color }}
        />
      </div>
      <span
        className="min-w-9 font-mono text-[11px] tracking-[0.04em]"
        style={{ color }}
      >
        {percentage}%
      </span>
    </div>
  )
}
