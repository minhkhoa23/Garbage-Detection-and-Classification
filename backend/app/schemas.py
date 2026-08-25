from typing import Literal

from pydantic import BaseModel, Field


class BoundingBox(BaseModel):
    x: float = Field(ge=0.0, le=1.0)
    y: float = Field(ge=0.0, le=1.0)
    w: float = Field(ge=0.0, le=1.0)
    h: float = Field(ge=0.0, le=1.0)


class Detection(BaseModel):
    id: int = Field(ge=1)
    label: str
    confidence: float = Field(ge=0.0, le=1.0)
    box: BoundingBox
    color: str
    category: str


class ImageInfo(BaseModel):
    width: int = Field(gt=0)
    height: int = Field(gt=0)


class PredictResponse(BaseModel):
    request_id: str
    image: ImageInfo
    count: int = Field(ge=0)
    detections: list[Detection]
    inference_ms: float = Field(ge=0.0)


class HealthResponse(BaseModel):
    status: Literal["ok"]
    model_loaded: bool
    model_name: str
    classes: list[str]


class ClassPresentation(BaseModel):
    class_name: str
    label: str
    category: str
    color: str


class RuntimeConfigResponse(BaseModel):
    predict_path: str
    default_confidence: float = Field(ge=0.0, le=1.0)
    max_upload_bytes: int = Field(gt=0)
    allowed_image_types: list[str]
    classes: list[ClassPresentation]