import { useRef, useState } from "react"
import type { ChangeEvent, DragEvent, KeyboardEvent } from "react"
import { BYTES_PER_MIB } from "../config/ui"
import type { RuntimeConfig } from "../types/garbageDetectionApi"

type UploadPanelProps = {
  runtimeConfig: RuntimeConfig | null
  disabled: boolean
  onFileSelected: (file: File) => void
}

function fileTypeLabel(mimeType: string) {
  const subtype = mimeType.split("/")[1]
  return subtype?.toUpperCase() ?? mimeType.toUpperCase()
}

export default function UploadPanel({
  runtimeConfig,
  disabled,
  onFileSelected,
}: UploadPanelProps) {
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isReady = Boolean(runtimeConfig) && !disabled

  const acceptedMimeTypes = runtimeConfig?.allowed_image_types.join(",") ?? ""
  const uploadDescription = runtimeConfig
    ? `${runtimeConfig.allowed_image_types.map(fileTypeLabel).join(" · ")} · up to ${runtimeConfig.max_upload_bytes / BYTES_PER_MIB} MiB`
    : "Loading backend configuration..."
  const supportedCategories = runtimeConfig
    ? Array.from(
        new Map<string, string>(
          runtimeConfig.classes.map((item) => [item.category, item.color]),
        ).entries(),
      )
    : []

  const openFilePicker = () => {
    if (isReady) fileInputRef.current?.click()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      openFilePicker()
    }
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragOver(false)

    if (!isReady) return
    const file = event.dataTransfer.files[0]
    if (file) onFileSelected(file)
  }

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) onFileSelected(file)
    event.target.value = ""
  }

  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-12">
      <div className="max-w-[520px] text-center">
        <div className="mb-4 font-mono text-[10px] tracking-[0.2em] text-green-dim uppercase">
          {runtimeConfig
            ? `CV / ${runtimeConfig.classes.length} model classes`
            : "CV / Connecting to model"}
        </div>
        <h1 className="m-0 mb-4 font-display text-[clamp(32px,5vw,52px)] leading-[1.1] font-semibold tracking-[-0.03em] text-text">
          Identify waste.
          <br />
          <span className="text-green-dim">Classify instantly.</span>
        </h1>
        <p className="m-0 text-[15px] leading-6 text-text-muted">
          Upload an image containing waste items. The model detects each object,
          draws bounding boxes, and returns category labels with confidence
          scores.
        </p>
      </div>

      <div
        role="button"
        tabIndex={isReady ? 0 : -1}
        aria-disabled={!isReady}
        onDrop={handleDrop}
        onDragOver={(event) => {
          event.preventDefault()
          if (isReady) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onClick={openFilePicker}
        onKeyDown={handleKeyDown}
        className={`flex w-full max-w-[560px] flex-col items-center gap-4 rounded-lg border-[1.5px] border-dashed px-8 py-[52px] transition ${
          isReady
            ? "cursor-pointer opacity-100"
            : "cursor-not-allowed opacity-60"
        } ${
          dragOver
            ? "border-green-dim bg-green-dim/5"
            : "border-border-bright bg-surface"
        }`}
      >
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <rect
            x="1"
            y="1"
            width="38"
            height="38"
            rx="6"
            stroke={
              dragOver ? "var(--color-green-dim)" : "var(--color-border-bright)"
            }
            strokeWidth="1.5"
          />
          <path
            d="M20 26V14M20 14L14 20M20 14L26 20"
            stroke={
              dragOver ? "var(--color-green-dim)" : "var(--color-text-muted)"
            }
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M13 29H27"
            stroke={
              dragOver ? "var(--color-green-dim)" : "var(--color-text-dim)"
            }
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>

        <div>
          <p className="m-0 mb-1 text-center font-display text-[15px] font-medium text-text">
            {isReady
              ? "Drop image here or click to browse"
              : "Waiting for backend configuration"}
          </p>
          <p className="m-0 text-center font-mono text-[10px] tracking-[0.08em] text-text-dim">
            {uploadDescription}
          </p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedMimeTypes}
        disabled={!isReady}
        className="hidden"
        onChange={handleFileInput}
      />

      <div className="flex max-w-[480px] flex-wrap justify-center gap-2">
        {supportedCategories.map(([category, color]) => (
          <span
            key={category}
            className="rounded-[2px] border px-2 py-[3px] font-mono text-[9px] tracking-[0.12em] uppercase"
            style={{
              color,
              background: `${color}14`,
              borderColor: `${color}30`,
            }}
          >
            {category}
          </span>
        ))}
      </div>
    </section>
  )
}
