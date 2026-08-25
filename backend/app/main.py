from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Annotated, AsyncIterator
from uuid import uuid4

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware

from backend.app.class_catalog import ClassCatalog
from backend.app.config import settings
from backend.app.schemas import (
    ClassPresentation,
    HealthResponse,
    ImageInfo,
    PredictResponse,
    RuntimeConfigResponse,
)
from backend.app.services.detector import GarbageDetector


logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    logger.info("Loading model from %s", settings.model_path)
    class_catalog = ClassCatalog.from_file(settings.class_mapping_path)
    app.state.detector = GarbageDetector(
        model_path=settings.model_path,
        image_size=settings.image_size,
        device=settings.model_device,
        class_catalog=class_catalog,
    )
    app.state.class_catalog = class_catalog
    logger.info("Model loaded successfully")
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    docs_url=settings.docs_url,
    openapi_url=settings.openapi_url,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=settings.cors_allow_methods,
    allow_headers=settings.cors_allow_headers,
)


def get_detector(request: Request) -> GarbageDetector:
    detector = getattr(request.app.state, "detector", None)
    if detector is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model is not ready",
        )
    return detector


def get_class_catalog(request: Request) -> ClassCatalog:
    class_catalog = getattr(request.app.state, "class_catalog", None)
    if class_catalog is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Class catalog is not ready",
        )
    return class_catalog


@app.get(settings.health_path, response_model=HealthResponse)
async def health(request: Request) -> HealthResponse:
    detector = get_detector(request)
    return HealthResponse(
        status="ok",
        model_loaded=True,
        model_name=detector.model_path.name,
        classes=detector.class_names,
    )


@app.get(settings.runtime_config_path, response_model=RuntimeConfigResponse)
async def runtime_config(request: Request) -> RuntimeConfigResponse:
    class_catalog = get_class_catalog(request)
    return RuntimeConfigResponse(
        predict_path=settings.predict_path,
        default_confidence=settings.default_confidence,
        max_upload_bytes=settings.max_upload_bytes,
        allowed_image_types=settings.allowed_image_types,
        classes=[
            ClassPresentation(
                class_name=class_name,
                label=rule.label,
                category=rule.category,
                color=rule.color,
            )
            for class_name, rule in class_catalog.items()
        ],
    )


@app.post(settings.predict_path, response_model=PredictResponse)
async def predict(
    request: Request,
    file: Annotated[UploadFile, File(...)],
    confidence: Annotated[
        float,
        Form(ge=settings.min_confidence, le=settings.max_confidence),
    ] = (
        settings.default_confidence
    ),
) -> PredictResponse:
    if file.content_type not in settings.allowed_image_types:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                "Allowed image MIME types: "
                + ", ".join(settings.allowed_image_types)
            ),
        )

    content = await file.read(settings.max_upload_bytes + 1)
    await file.close()

    if not content:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Uploaded file is empty",
        )

    if len(content) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image must be at most {settings.max_upload_mb} MB",
        )

    encoded = np.frombuffer(content, dtype=np.uint8)
    image_bgr = cv2.imdecode(encoded, cv2.IMREAD_COLOR)

    if image_bgr is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="File content is not a valid image",
        )

    height, width = image_bgr.shape[:2]
    if width * height > settings.max_image_pixels:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image dimensions are too large",
        )

    detector = get_detector(request)
    try:
        detections, inference_ms = await run_in_threadpool(
            detector.predict,
            image_bgr,
            confidence,
        )
    except Exception as exc:
        logger.exception("Inference failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Inference failed",
        ) from exc

    return PredictResponse(
        request_id=uuid4().hex,
        image=ImageInfo(width=width, height=height),
        count=len(detections),
        detections=detections,
        inference_ms=round(inference_ms, settings.inference_time_decimals),
    )
