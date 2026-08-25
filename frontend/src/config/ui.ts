import type { BackendStatus } from "../types/ui"

export const BYTES_PER_MIB = 1024 * 1024

export const ANALYSIS_PROGRESS = {
  tickMs: 150,
  increment: 2,
  waitingCap: 90,
  completed: 100,
} as const

export const CONFIDENCE_LEVELS = {
  high: 0.9,
  medium: 0.75,
} as const

export const BACKEND_STATUS_VIEW: Record<BackendStatus, {
  label: string
  color: string
}> = {
  checking: {
    label: "CHECKING MODEL",
    color: "var(--color-amber)",
  },
  ready: {
    label: "MODEL ACTIVE",
    color: "var(--color-green)",
  },
  offline: {
    label: "BACKEND OFFLINE",
    color: "var(--color-red)",
  },
}
