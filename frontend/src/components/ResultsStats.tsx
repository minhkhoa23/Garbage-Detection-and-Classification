import type { Detection } from "../types/garbageDetectionApi"

export default function ResultsStats({
  detections,
}: {
  detections: Detection[]
}) {
  const topConfidence = detections.length
    ? Math.max(...detections.map((detection) => detection.confidence))
    : 0
  const averageConfidence = detections.length
    ? detections.reduce((total, detection) => total + detection.confidence, 0) /
      detections.length
    : 0
  const stats = [
    { label: "DETECTED", value: detections.length.toString(), unit: "obj" },
    {
      label: "TOP CONF",
      value: Math.round(topConfidence * 100).toString(),
      unit: "%",
    },
    {
      label: "AVG CONF",
      value: Math.round(averageConfidence * 100).toString(),
      unit: "%",
    },
  ]

  return (
    <div className="grid grid-cols-3 gap-2">
      {stats.map(({ label, value, unit }) => (
        <div
          key={label}
          className="rounded-md border border-border bg-surface px-2.5 py-3"
        >
          <div className="mb-1.5 font-mono text-[8px] tracking-[0.14em] text-text-dim">
            {label}
          </div>
          <div className="flex items-baseline gap-0.5">
            <span className="font-display text-[22px] leading-none font-semibold text-text">
              {value}
            </span>
            <span className="font-mono text-[9px] text-text-muted">{unit}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
