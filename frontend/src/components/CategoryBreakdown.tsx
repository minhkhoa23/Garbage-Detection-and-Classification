import type { Detection } from "../types/garbageDetectionApi"

type CategoryGroup = {
  category: string
  color: string
  count: number
}

function groupDetections(detections: Detection[]): CategoryGroup[] {
  const groups = new Map<string, CategoryGroup>()

  detections.forEach((detection) => {
    const current = groups.get(detection.category)

    if (current) {
      current.count += 1
    } else {
      groups.set(detection.category, {
        category: detection.category,
        color: detection.color,
        count: 1,
      })
    }
  })

  return Array.from(groups.values())
}

export default function CategoryBreakdown({
  detections,
}: {
  detections: Detection[]
}) {
  const groups = groupDetections(detections)

  return (
    <section className="rounded-md border border-border bg-surface px-4 py-3.5">
      <div className="mb-3 font-mono text-[9px] tracking-[0.1em] text-text-muted uppercase">
        Category Breakdown
      </div>

      {groups.length === 0 ? (
        <div className="text-[12px] text-text-dim">No category data.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map(({ category, color, count }) => {
            const percentage = Math.round((count / detections.length) * 100)

            return (
              <div key={category}>
                <div className="mb-1 flex justify-between">
                  <span
                    className="font-mono text-[9px] tracking-[0.1em] uppercase"
                    style={{ color }}
                  >
                    {category}
                  </span>
                  <span className="font-mono text-[9px] text-text-muted">
                    {count} · {percentage}%
                  </span>
                </div>
                <div className="h-0.5 rounded-sm bg-border">
                  <div
                    className="h-full rounded-sm opacity-80 transition-[width] duration-500"
                    style={{ width: `${percentage}%`, background: color }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
