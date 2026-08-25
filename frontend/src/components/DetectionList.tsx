import type { Detection } from "../types/garbageDetectionApi"
import CategoryBadge from "./CategoryBadge"
import ConfidenceBar from "./ConfidenceBar"

type DetectionListProps = {
  detections: Detection[]
  hoveredId: number | null
  onHover: (id: number | null) => void
}

export default function DetectionList({
  detections,
  hoveredId,
  onHover,
}: DetectionListProps) {
  const sortedDetections = [...detections].sort(
    (left, right) => right.confidence - left.confidence,
  )

  return (
    <section className="flex-1 overflow-hidden rounded-md border border-border bg-surface">
      <div className="border-b border-border px-4 py-3 font-mono text-[9px] tracking-[0.1em] text-text-muted uppercase">
        Detections
      </div>
      <div className="p-2">
        {sortedDetections.length === 0 ? (
          <div className="p-6 text-center text-[13px] text-text-muted">
            No waste objects were detected at the current confidence threshold.
          </div>
        ) : (
          sortedDetections.map((detection, index) => {
            const highlighted = hoveredId === detection.id

            return (
              <div
                key={detection.id}
                onMouseEnter={() => onHover(detection.id)}
                onMouseLeave={() => onHover(null)}
                className={`mb-0.5 rounded-sm border p-2.5 transition ${
                  highlighted
                    ? "border-border-bright bg-panel"
                    : "border-transparent bg-transparent"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="flex flex-col items-center gap-1 pt-0.5">
                    <span className="font-mono text-[9px] text-text-dim">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div
                      className="h-6 w-0.5 rounded-sm opacity-70"
                      style={{ background: detection.color }}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between gap-1.5">
                      <span className="truncate font-display text-[13px] font-medium text-text">
                        {detection.label}
                      </span>
                      <CategoryBadge
                        category={detection.category}
                        color={detection.color}
                      />
                    </div>
                    <ConfidenceBar value={detection.confidence} />
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
