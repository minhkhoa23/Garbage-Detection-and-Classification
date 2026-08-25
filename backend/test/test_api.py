import cv2
import numpy as np
import pytest
from fastapi import status
from fastapi.testclient import TestClient

from backend.app.class_catalog import ClassCatalog
from backend.app.config import settings
from backend.app.main import app


TEST_IMAGE_EXTENSION = ".jpg"
TEST_IMAGE_MIME_TYPE = "image/jpeg"
INVALID_IMAGE_MIME_TYPE = "text/plain"
NORMALIZED_MIN = 0.0
NORMALIZED_MAX = 1.0
FLOAT_TOLERANCE = 1e-6


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="module")
def class_catalog() -> ClassCatalog:
    return ClassCatalog.from_file(settings.class_mapping_path)


def make_blank_jpeg() -> bytes:
    image_shape = (settings.image_size, settings.image_size, 3)
    image = np.full(image_shape, 255, dtype=np.uint8)
    success, encoded = cv2.imencode(TEST_IMAGE_EXTENSION, image)
    assert success
    return encoded.tobytes()


def test_health_exposes_checkpoint_classes(
    client: TestClient,
    class_catalog: ClassCatalog,
) -> None:
    response = client.get(settings.health_path)

    assert response.status_code == status.HTTP_200_OK
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["model_loaded"] is True
    assert payload["classes"] == class_catalog.class_names


def test_runtime_config_comes_from_sources(
    client: TestClient,
    class_catalog: ClassCatalog,
) -> None:
    response = client.get(settings.runtime_config_path)

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {
        "predict_path": settings.predict_path,
        "default_confidence": settings.default_confidence,
        "max_upload_bytes": settings.max_upload_bytes,
        "allowed_image_types": settings.allowed_image_types,
        "classes": [
            {
                "class_name": class_name,
                "label": rule.label,
                "category": rule.category,
                "color": rule.color,
            }
            for class_name, rule in class_catalog.items()
        ],
    }


def test_predict_response_matches_frontend_contract(
    client: TestClient,
    class_catalog: ClassCatalog,
) -> None:
    assert TEST_IMAGE_MIME_TYPE in settings.allowed_image_types
    response = client.post(
        settings.predict_path,
        files={
            "file": (
                f"blank{TEST_IMAGE_EXTENSION}",
                make_blank_jpeg(),
                TEST_IMAGE_MIME_TYPE,
            )
        },
    )

    assert response.status_code == status.HTTP_200_OK
    payload = response.json()
    assert payload["count"] == len(payload["detections"])
    assert payload["image"] == {
        "width": settings.image_size,
        "height": settings.image_size,
    }

    for detection in payload["detections"]:
        assert NORMALIZED_MIN <= detection["confidence"] <= NORMALIZED_MAX
        box = detection["box"]
        assert all(
            NORMALIZED_MIN <= box[key] <= NORMALIZED_MAX
            for key in ("x", "y", "w", "h")
        )
        assert (
            box["x"] + box["w"]
            <= NORMALIZED_MAX + FLOAT_TOLERANCE
        )
        assert (
            box["y"] + box["h"]
            <= NORMALIZED_MAX + FLOAT_TOLERANCE
        )
        assert detection["color"].startswith("#")
        assert detection["category"] in class_catalog.categories


def test_rejects_non_image_content_type(client: TestClient) -> None:
    response = client.post(
        settings.predict_path,
        files={
            "file": (
                "invalid-upload",
                b"not an image",
                INVALID_IMAGE_MIME_TYPE,
            )
        },
    )

    assert response.status_code == status.HTTP_415_UNSUPPORTED_MEDIA_TYPE


def test_rejects_fake_image_content(client: TestClient) -> None:
    response = client.post(
        settings.predict_path,
        files={
            "file": (
                "fake-image",
                b"not an image",
                settings.allowed_image_types[0],
            )
        },
    )

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
