export type BoundingBox = {
  x: number

  y: number

  w: number

  h: number
}

export type Detection = {
  id: number

  label: string

  confidence: number

  box: BoundingBox

  color: string

  category: string
}

export type ClassPresentation = {
  class_name: string

  label: string

  category: string

  color: string
}

export type RuntimeConfig = {
  predict_path: string

  default_confidence: number

  max_upload_bytes: number

  allowed_image_types: string[]

  classes: ClassPresentation[]
}

export type PredictResponse = {
  request_id: string

  image: {
    width: number

    height: number
  }

  count: number

  detections: Detection[]

  inference_ms: number
}
