import type { PredictResponse } from "./garbageDetectionApi"

export type AnalysisStage = "idle" | "processing" | "done"

export type BackendStatus = "checking" | "ready" | "offline"

export type PredictionMeta = Pick<PredictResponse, "request_id" | "inference_ms">
