import { useState } from "react"
import type { Detection } from "../types/garbageDetectionApi"
import type { PredictionMeta } from "../types/ui"
import CategoryBreakdown from "./CategoryBreakdown"
import DetectionCanvas from "./DetectionCanvas"
import DetectionList from "./DetectionList"
import ResultsStats from "./ResultsStats"

type ResultsPanelProps = {
  imageUrl: string
  detections: Detection[]
  predictionMeta: PredictionMeta | null
  onReset: () => void
}

export default function ResultsPanel({
  imageUrl,
  detections,
  predictionMeta,
  onReset,
}: ResultsPanelProps) {
  const [hoveredId, setHoveredId] = useState<number | null>(null)

  return (
    <section className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] tracking-[0.1em] text-text-muted uppercase">
              Detection Output
            </span>
            <span className="rounded-[2px] border border-green-dim/20 bg-green-dim/5 px-1.5 py-px font-mono text-[9px] text-green-dim">
              {detections.length} objects
            </span>
          </div>

          <div className="flex items-center gap-3 font-mono text-[9px] tracking-[0.08em] text-text-dim">
            {predictionMeta && (
              <span title={`Request: ${predictionMeta.request_id}`}>
                {predictionMeta.inference_ms} ms
              </span>
            )}
            {detections.length > 0 && (
              <span className="hidden sm:inline">
                hover detections to highlight
              </span>
            )}
          </div>
        </div>

        <div className="relative min-h-[420px] flex-1 overflow-hidden rounded-md border border-border bg-surface">
          <DetectionCanvas
            imageUrl={imageUrl}
            detections={detections}
            hoveredId={hoveredId}
          />
        </div>
      </div>

      <aside className="flex min-h-0 flex-col gap-4 overflow-auto">
        <ResultsStats detections={detections} />
        <DetectionList
          detections={detections}
          hoveredId={hoveredId}
          onHover={setHoveredId}
        />
        <CategoryBreakdown detections={detections} />
        <button
          type="button"
          onClick={onReset}
          className="w-full cursor-pointer rounded-[5px] bg-green px-0 py-2.5 font-display text-[13px] font-medium text-white transition hover:bg-green-dim"
        >
          Analyze Another Image
        </button>
      </aside>
    </section>
  )
}
