import { useCallback, useEffect, useRef, useState } from "react"
import { getRuntimeConfig } from "../services/garbageDetectionApi"
import type { RuntimeConfig } from "../types/garbageDetectionApi"
import type { BackendStatus } from "../types/ui"

export function useRuntimeConfig() {
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig | null>(null)
  const [status, setStatus] = useState<BackendStatus>("checking")
  const [error, setError] = useState<string | null>(null)
  const requestRef = useRef<AbortController | null>(null)

  const reload = useCallback(async () => {
    requestRef.current?.abort()

    const controller = new AbortController()
    requestRef.current = controller
    setStatus("checking")
    setError(null)

    try {
      const config = await getRuntimeConfig(controller.signal)

      if (requestRef.current !== controller) {
        return
      }

      setRuntimeConfig(config)
      setStatus("ready")
    } catch (requestError) {
      if (controller.signal.aborted || requestRef.current !== controller) {
        return
      }

      setRuntimeConfig(null)
      setStatus("offline")
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Cannot connect to the backend",
      )
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    void reload()

    return () => requestRef.current?.abort()
  }, [reload])

  return {
    runtimeConfig,
    status,
    error,
    reload,
  }
}
