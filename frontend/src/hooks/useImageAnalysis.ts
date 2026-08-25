import { useCallback, useEffect, useRef, useState } from "react"
import { ANALYSIS_PROGRESS, BYTES_PER_MIB } from "../config/ui"
import { predictImage } from "../services/garbageDetectionApi"
import type { Detection, RuntimeConfig } from "../types/garbageDetectionApi"
import type { AnalysisStage, PredictionMeta } from "../types/ui"

function validateImageFile(file: File, config: RuntimeConfig) {
  if (!config.allowed_image_types.includes(file.type)) {
    throw new Error(
      `Unsupported image type. Allowed: ${config.allowed_image_types.join(", ")}`,
    )
  }

  if (file.size === 0) {
    throw new Error("The selected file is empty")
  }

  if (file.size > config.max_upload_bytes) {
    const maxMiB = config.max_upload_bytes / BYTES_PER_MIB
    throw new Error(`Image must be at most ${maxMiB} MiB`)
  }
}

export function useImageAnalysis(runtimeConfig: RuntimeConfig | null) {
  const [stage, setStage] = useState<AnalysisStage>("idle")
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [detections, setDetections] = useState<Detection[]>([])
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [predictionMeta, setPredictionMeta] = useState<PredictionMeta | null>(
    null,
  )

  const requestRef = useRef<AbortController | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const progressTimerRef = useRef<number | null>(null)

  const clearProgressTimer = useCallback(() => {
    if (progressTimerRef.current !== null) {
      window.clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
  }, [])

  const releaseObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    requestRef.current?.abort()
    requestRef.current = null
    clearProgressTimer()
    releaseObjectUrl()

    setStage("idle")
    setImageUrl(null)
    setDetections([])
    setProgress(0)
    setPredictionMeta(null)
    setError(null)
  }, [clearProgressTimer, releaseObjectUrl])

  const analyze = useCallback(
    async (file: File) => {
      if (!runtimeConfig) {
        setError("Backend configuration is not ready")
        return
      }

      try {
        validateImageFile(file, runtimeConfig)
      } catch (validationError) {
        setError(
          validationError instanceof Error
            ? validationError.message
            : "Invalid image",
        )
        return
      }

      requestRef.current?.abort()
      clearProgressTimer()
      releaseObjectUrl()

      const controller = new AbortController()
      const previewUrl = URL.createObjectURL(file)
      requestRef.current = controller
      objectUrlRef.current = previewUrl

      setImageUrl(previewUrl)
      setStage("processing")
      setProgress(0)
      setDetections([])
      setPredictionMeta(null)
      setError(null)

      const progressTimer = window.setInterval(() => {
        setProgress((current) =>
          Math.min(
            current + ANALYSIS_PROGRESS.increment,
            ANALYSIS_PROGRESS.waitingCap,
          ),
        )
      }, ANALYSIS_PROGRESS.tickMs)
      progressTimerRef.current = progressTimer

      try {
        const result = await predictImage(
          file,
          runtimeConfig,
          controller.signal,
        )

        if (controller.signal.aborted || requestRef.current !== controller) {
          return
        }

        setDetections(result.detections)
        setPredictionMeta({
          request_id: result.request_id,
          inference_ms: result.inference_ms,
        })
        setProgress(ANALYSIS_PROGRESS.completed)
        setStage("done")
      } catch (requestError) {
        if (controller.signal.aborted || requestRef.current !== controller) {
          return
        }

        releaseObjectUrl()
        setImageUrl(null)
        setStage("idle")
        setProgress(0)
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Image analysis failed",
        )
      } finally {
        window.clearInterval(progressTimer)

        if (progressTimerRef.current === progressTimer) {
          progressTimerRef.current = null
        }

        if (requestRef.current === controller) {
          requestRef.current = null
        }
      }
    },
    [clearProgressTimer, releaseObjectUrl, runtimeConfig],
  )

  useEffect(() => {
    return () => {
      requestRef.current?.abort()
      clearProgressTimer()
      releaseObjectUrl()
    }
  }, [clearProgressTimer, releaseObjectUrl])

  return {
    stage,
    imageUrl,
    detections,
    progress,
    error,
    predictionMeta,
    analyze,
    reset,
    clearError: () => setError(null),
  }
}
