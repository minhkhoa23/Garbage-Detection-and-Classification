from __future__ import annotations

from pathlib import Path
from threading import Lock
from time import perf_counter
from typing import Any

import numpy as np
from ultralytics import YOLO

from backend.app.class_catalog import ClassCatalog
from backend.app.schemas import BoundingBox, Detection


class GarbageDetector:
    def __init__(
        self,
        model_path: Path,
        image_size: int,
        device: str,
        class_catalog: ClassCatalog,
    ) -> None:
        if not model_path.is_file():
            raise FileNotFoundError(f"Model file not found: {model_path}")

        self.model_path = model_path
        self.image_size = image_size
        self.device = device.strip()
        self.class_catalog = class_catalog
        self._model = YOLO(str(model_path))
        self._predict_lock = Lock()

        missing_mappings = {
            class_name.strip().upper()
            for class_name in self.class_names
            if class_name.strip().upper() not in self.class_catalog.class_names
        }
        if missing_mappings:
            missing = ", ".join(sorted(missing_mappings))
            raise ValueError(f"Missing class mappings for: {missing}")

    @property
    def class_names(self) -> list[str]:
        names = self._model.names
        if isinstance(names, dict):
            return [str(names[index]) for index in sorted(names)]
        return [str(name) for name in names]

    def _class_name(self, class_id: int) -> str:
        names = self._model.names
        if isinstance(names, dict):
            return str(names[class_id])
        return str(names[class_id])

    def predict(
        self,
        image_bgr: np.ndarray[Any, np.dtype[np.uint8]],
        confidence: float,
    ) -> tuple[list[Detection], float]:
        height, width = image_bgr.shape[:2]

        predict_options: dict[str, Any] = {
            "source": image_bgr,
            "conf": confidence,
            "imgsz": self.image_size,
            "save": False,
            "verbose": False,
        }
        if self.device:
            predict_options["device"] = self.device

        started_at = perf_counter()
        with self._predict_lock:
            result = self._model.predict(**predict_options)[0]
            boxes = result.boxes

            if boxes is None or len(boxes) == 0:
                inference_ms = (perf_counter() - started_at) * 1000
                return [], inference_ms

            xyxy_values = boxes.xyxy.detach().cpu().numpy().copy()
            confidence_values = boxes.conf.detach().cpu().numpy().copy()
            class_values = boxes.cls.detach().cpu().numpy().astype(int).copy()

        inference_ms = (perf_counter() - started_at) * 1000
        records: list[dict[str, Any]] = []

        for xyxy, score, class_id in zip(
            xyxy_values,
            confidence_values,
            class_values,
            strict=True,
        ):
            x1, y1, x2, y2 = (float(value) for value in xyxy)

            x1 = min(max(x1, 0.0), float(width))
            y1 = min(max(y1, 0.0), float(height))
            x2 = min(max(x2, 0.0), float(width))
            y2 = min(max(y2, 0.0), float(height))

            if x2 <= x1 or y2 <= y1:
                continue

            raw_name = self._class_name(int(class_id))
            class_rule = self.class_catalog.rule_for(raw_name)

            records.append(
                {
                    "label": class_rule.label,
                    "confidence": float(score),
                    "box": BoundingBox(
                        x=x1 / width,
                        y=y1 / height,
                        w=(x2 - x1) / width,
                        h=(y2 - y1) / height,
                    ),
                    "color": class_rule.color,
                    "category": class_rule.category,
                }
            )

        records.sort(key=lambda item: item["confidence"], reverse=True)

        detections = [
            Detection(id=index, **record)
            for index, record in enumerate(records, start=1)
        ]
        return detections, inference_ms
