import type {
  PredictResponse,
  RuntimeConfig,
} from "../types/garbageDetectionApi"

type ValidationIssue = {
  msg?: string

  loc?: Array<string | number>
}

type ApiErrorBody = {
  detail?: string | ValidationIssue[]
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim()

const RUNTIME_CONFIG_PATH = import.meta.env.VITE_RUNTIME_CONFIG_PATH?.trim()

function requiredEnvironmentValue(
  value: string | undefined,

  variableName: string,
): string {
  if (!value) {
    throw new Error(`Missing frontend environment variable: ${variableName}`)
  }

  return value
}

function apiUrl(path: string): string {
  const baseUrl = requiredEnvironmentValue(
    API_BASE_URL,

    "VITE_API_BASE_URL",
  )

  const normalizedBaseUrl = `${baseUrl.replace(/\/+$/, "")}/`

  const normalizedPath = path.replace(/^\/+/, "")

  return new URL(normalizedPath, normalizedBaseUrl).toString()
}

async function apiErrorMessage(response: Response): Promise<string> {
  const fallback = `Backend request failed with status ${response.status}`

  try {
    const body = (await response.json()) as ApiErrorBody

    if (typeof body.detail === "string") {
      return body.detail
    }

    if (Array.isArray(body.detail)) {
      const messages = body.detail

        .map((issue) => issue.msg)

        .filter((message): message is string => Boolean(message))

      if (messages.length > 0) {
        return messages.join(", ")
      }
    }
  } catch {
    // Fall back to a status-based message for non-JSON responses.
  }

  return fallback
}

export async function getRuntimeConfig(
  signal?: AbortSignal,
): Promise<RuntimeConfig> {
  const configPath = requiredEnvironmentValue(
    RUNTIME_CONFIG_PATH,

    "VITE_RUNTIME_CONFIG_PATH",
  )

  const response = await fetch(apiUrl(configPath), {
    method: "GET",

    headers: {
      Accept: "application/json",
    },

    signal,
  })

  if (!response.ok) {
    throw new Error(await apiErrorMessage(response))
  }

  return (await response.json()) as RuntimeConfig
}

export async function predictImage(
  file: File,

  runtimeConfig: RuntimeConfig,

  signal?: AbortSignal,
): Promise<PredictResponse> {
  const body = new FormData()

  body.append("file", file, file.name)

  const response = await fetch(apiUrl(runtimeConfig.predict_path), {
    method: "POST",

    body,

    signal,
  })

  if (!response.ok) {
    throw new Error(await apiErrorMessage(response))
  }

  const result = (await response.json()) as PredictResponse

  if (!Array.isArray(result.detections)) {
    throw new Error("Backend returned an invalid prediction response")
  }

  return result
}
