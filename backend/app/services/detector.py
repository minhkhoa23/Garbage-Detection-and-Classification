from __future__ import annotations

import math
from collections import OrderedDict
from pathlib import Path
from threading import Lock
from time import perf_counter
from typing import Any, Sequence

import numpy as np
import torch
from torch import Tensor, nn
from torch.nn import functional as torch_functional
from torchvision.models.detection import FasterRCNN
from torchvision.models.detection.anchor_utils import AnchorGenerator
from torchvision.ops import MultiScaleRoIAlign

from backend.app.class_catalog import ClassCatalog
from backend.app.schemas import BoundingBox, Detection


CHECKPOINT_STATE_DICT_KEY = "model_state_dict"
CHECKPOINT_CLASS_NAMES_KEY = "class_names"
CHECKPOINT_CONFIG_KEY = "config"
DEFAULT_IMAGE_MIN_SIZE = 416
DEFAULT_IMAGE_MAX_SIZE = 672
DEFAULT_VIT_INTERMEDIATE_LAYER = 11
BACKGROUND_LABEL_OFFSET = 1


class LinearKMaskedBias(nn.Linear):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        output_features = self.out_features
        if self.bias is not None:
            self.register_buffer(
                "bias_mask",
                torch.ones(output_features, dtype=self.bias.dtype),
                persistent=True,
            )

    def forward(self, input: Tensor) -> Tensor:
        bias = self.bias
        if bias is not None:
            bias = bias * self.bias_mask.to(dtype=bias.dtype)
        return torch_functional.linear(input, self.weight, bias)


def rope_rotate_half(x: Tensor) -> Tensor:
    x1, x2 = x.chunk(2, dim=-1)
    return torch.cat((-x2, x1), dim=-1)


def rope_apply(x: Tensor, sin: Tensor, cos: Tensor) -> Tensor:
    return (x * cos) + (rope_rotate_half(x) * sin)


class RopePositionEmbedding(nn.Module):
    def __init__(
        self,
        embed_dim: int,
        *,
        num_heads: int,
        base: float = 100.0,
        normalize_coords: str = "separate",
        rescale_coords: float | None = 2.0,
        dtype: torch.dtype = torch.float32,
    ) -> None:
        super().__init__()
        if embed_dim % (4 * num_heads) != 0:
            raise ValueError("embed_dim must be divisible by 4 * num_heads")

        self.base = base
        self.head_dim = embed_dim // num_heads
        self.normalize_coords = normalize_coords
        self.rescale_coords = rescale_coords
        self.dtype = dtype
        self.register_buffer(
            "periods",
            torch.empty(self.head_dim // 4, dtype=dtype),
            persistent=True,
        )
        self._init_weights()

    def forward(self, *, H: int, W: int) -> tuple[Tensor, Tensor]:
        device = self.periods.device
        dtype = self.dtype

        if self.normalize_coords == "max":
            max_hw = max(H, W)
            coords_h = torch.arange(0.5, H, device=device, dtype=dtype) / max_hw
            coords_w = torch.arange(0.5, W, device=device, dtype=dtype) / max_hw
        elif self.normalize_coords == "min":
            min_hw = min(H, W)
            coords_h = torch.arange(0.5, H, device=device, dtype=dtype) / min_hw
            coords_w = torch.arange(0.5, W, device=device, dtype=dtype) / min_hw
        elif self.normalize_coords == "separate":
            coords_h = torch.arange(0.5, H, device=device, dtype=dtype) / H
            coords_w = torch.arange(0.5, W, device=device, dtype=dtype) / W
        else:
            raise ValueError(f"Unknown normalize_coords: {self.normalize_coords}")

        coords = torch.stack(
            torch.meshgrid(coords_h, coords_w, indexing="ij"),
            dim=-1,
        )
        coords = coords.flatten(0, 1)
        coords = 2.0 * coords - 1.0

        angles = 2 * math.pi * coords[:, :, None] / self.periods[None, None, :]
        angles = angles.flatten(1, 2).tile(2)
        return torch.sin(angles), torch.cos(angles)

    def _init_weights(self) -> None:
        dtype = self.dtype
        periods = self.base ** (
            2
            * torch.arange(self.head_dim // 4, dtype=dtype)
            / (self.head_dim // 2)
        )
        self.periods.data = periods


class PatchEmbed(nn.Module):
    def __init__(
        self,
        *,
        patch_size: int = 16,
        in_channels: int = 3,
        embed_dim: int = 768,
    ) -> None:
        super().__init__()
        self.patch_size = patch_size
        self.proj = nn.Conv2d(
            in_channels,
            embed_dim,
            kernel_size=patch_size,
            stride=patch_size,
        )

    def forward(self, x: Tensor) -> Tensor:
        return self.proj(x).permute(0, 2, 3, 1)


class LayerScale(nn.Module):
    def __init__(self, dim: int, init_values: float = 1.0e-5) -> None:
        super().__init__()
        self.gamma = nn.Parameter(init_values * torch.ones(dim))

    def forward(self, x: Tensor) -> Tensor:
        return x * self.gamma


class Mlp(nn.Module):
    def __init__(
        self,
        *,
        in_features: int,
        hidden_features: int,
        out_features: int,
    ) -> None:
        super().__init__()
        self.fc1 = nn.Linear(in_features, hidden_features)
        self.act = nn.GELU()
        self.fc2 = nn.Linear(hidden_features, out_features)

    def forward(self, x: Tensor) -> Tensor:
        return self.fc2(self.act(self.fc1(x)))


class SelfAttention(nn.Module):
    def __init__(
        self,
        *,
        dim: int,
        num_heads: int,
        qkv_bias: bool = True,
        proj_bias: bool = True,
        mask_k_bias: bool = True,
    ) -> None:
        super().__init__()
        self.num_heads = num_heads
        self.qkv = LinearKMaskedBias(
            dim,
            dim * 3,
            bias=qkv_bias,
        ) if mask_k_bias else nn.Linear(dim, dim * 3, bias=qkv_bias)
        self.proj = nn.Linear(dim, dim, bias=proj_bias)

    def apply_rope(
        self,
        q: Tensor,
        k: Tensor,
        rope: tuple[Tensor, Tensor],
    ) -> tuple[Tensor, Tensor]:
        sin, cos = rope
        q_dtype = q.dtype
        k_dtype = k.dtype
        rope_dtype = sin.dtype
        q = q.to(dtype=rope_dtype)
        k = k.to(dtype=rope_dtype)

        token_count = q.shape[-2]
        prefix_count = token_count - sin.shape[-2]
        if prefix_count < 0:
            raise ValueError("RoPE token count is larger than attention input")

        q_prefix = q[:, :, :prefix_count, :]
        k_prefix = k[:, :, :prefix_count, :]
        q = rope_apply(q[:, :, prefix_count:, :], sin, cos)
        k = rope_apply(k[:, :, prefix_count:, :], sin, cos)

        return (
            torch.cat((q_prefix, q), dim=-2).to(dtype=q_dtype),
            torch.cat((k_prefix, k), dim=-2).to(dtype=k_dtype),
        )

    def forward(
        self,
        x: Tensor,
        rope: tuple[Tensor, Tensor] | None = None,
    ) -> Tensor:
        batch_size, token_count, channels = x.shape
        qkv = self.qkv(x)
        qkv = qkv.reshape(
            batch_size,
            token_count,
            3,
            self.num_heads,
            channels // self.num_heads,
        )
        q, k, v = torch.unbind(qkv, dim=2)
        q, k, v = (tensor.transpose(1, 2) for tensor in (q, k, v))

        if rope is not None:
            q, k = self.apply_rope(q, k, rope)

        attended = torch_functional.scaled_dot_product_attention(q, k, v)
        attended = attended.transpose(1, 2)
        attended = attended.reshape(batch_size, token_count, channels)
        return self.proj(attended)


class SelfAttentionBlock(nn.Module):
    def __init__(
        self,
        *,
        dim: int = 768,
        num_heads: int = 12,
        ffn_ratio: float = 4.0,
    ) -> None:
        super().__init__()
        hidden_dim = int(dim * ffn_ratio)
        self.norm1 = nn.LayerNorm(dim, eps=1.0e-5)
        self.attn = SelfAttention(dim=dim, num_heads=num_heads)
        self.ls1 = LayerScale(dim)
        self.norm2 = nn.LayerNorm(dim, eps=1.0e-5)
        self.mlp = Mlp(
            in_features=dim,
            hidden_features=hidden_dim,
            out_features=dim,
        )
        self.ls2 = LayerScale(dim)

    def forward(
        self,
        x: Tensor,
        rope: tuple[Tensor, Tensor] | None = None,
    ) -> Tensor:
        x = x + self.ls1(self.attn(self.norm1(x), rope=rope))
        return x + self.ls2(self.mlp(self.norm2(x)))


class DinoVisionTransformer(nn.Module):
    def __init__(
        self,
        *,
        patch_size: int = 16,
        embed_dim: int = 768,
        depth: int = 12,
        num_heads: int = 12,
        ffn_ratio: float = 4.0,
        n_storage_tokens: int = 4,
    ) -> None:
        super().__init__()
        self.embed_dim = embed_dim
        self.patch_size = patch_size
        self.n_storage_tokens = n_storage_tokens
        self.patch_embed = PatchEmbed(
            patch_size=patch_size,
            embed_dim=embed_dim,
        )
        self.cls_token = nn.Parameter(torch.empty(1, 1, embed_dim))
        self.storage_tokens = nn.Parameter(
            torch.empty(1, n_storage_tokens, embed_dim),
        )
        self.rope_embed = RopePositionEmbedding(
            embed_dim=embed_dim,
            num_heads=num_heads,
        )
        self.blocks = nn.ModuleList(
            [
                SelfAttentionBlock(
                    dim=embed_dim,
                    num_heads=num_heads,
                    ffn_ratio=ffn_ratio,
                )
                for _ in range(depth)
            ]
        )
        self.norm = nn.LayerNorm(embed_dim, eps=1.0e-5)
        self.head = nn.Identity()
        self.mask_token = nn.Parameter(torch.empty(1, embed_dim))

    def prepare_tokens_with_masks(
        self,
        x: Tensor,
        masks: Tensor | None = None,
    ) -> tuple[Tensor, tuple[int, int]]:
        x = self.patch_embed(x)
        batch_size, height, width, _ = x.shape
        x = x.flatten(1, 2)

        if masks is not None:
            x = torch.where(masks.unsqueeze(-1), self.mask_token, x)
            cls_token = self.cls_token
        else:
            cls_token = self.cls_token + 0 * self.mask_token

        x = torch.cat(
            [
                cls_token.expand(batch_size, -1, -1),
                self.storage_tokens.expand(batch_size, -1, -1),
                x,
            ],
            dim=1,
        )
        return x, (height, width)

    def _get_intermediate_layers_not_chunked(
        self,
        x: Tensor,
        n: int | Sequence[int] = 1,
    ) -> list[Tensor]:
        x, (height, width) = self.prepare_tokens_with_masks(x)
        output: list[Tensor] = []
        total_blocks = len(self.blocks)
        blocks_to_take = (
            range(total_blocks - n, total_blocks)
            if isinstance(n, int)
            else set(n)
        )

        for index, block in enumerate(self.blocks):
            rope = self.rope_embed(H=height, W=width)
            x = block(x, rope=rope)
            if index in blocks_to_take:
                output.append(x)

        expected_outputs = n if isinstance(n, int) else len(n)
        if len(output) != expected_outputs:
            raise ValueError(
                f"Only found {len(output)} of {expected_outputs} blocks",
            )
        return output

    def get_intermediate_layers(
        self,
        x: Tensor,
        *,
        n: int | Sequence[int] = 1,
        reshape: bool = False,
        return_class_token: bool = False,
        return_extra_tokens: bool = False,
        norm: bool = True,
    ) -> tuple[Tensor, ...] | tuple[tuple[Tensor, Tensor], ...]:
        outputs = self._get_intermediate_layers_not_chunked(x, n)
        if norm:
            outputs = [self.norm(output) for output in outputs]

        class_tokens = [output[:, 0] for output in outputs]
        extra_tokens = [
            output[:, 1 : self.n_storage_tokens + 1]
            for output in outputs
        ]
        outputs = [
            output[:, self.n_storage_tokens + 1 :]
            for output in outputs
        ]

        if reshape:
            batch_size, _, height, width = x.shape
            outputs = [
                output.reshape(
                    batch_size,
                    height // self.patch_size,
                    width // self.patch_size,
                    -1,
                )
                .permute(0, 3, 1, 2)
                .contiguous()
                for output in outputs
            ]

        if not return_class_token and not return_extra_tokens:
            return tuple(outputs)
        if return_class_token and not return_extra_tokens:
            return tuple(zip(outputs, class_tokens, strict=True))
        if not return_class_token and return_extra_tokens:
            return tuple(zip(outputs, extra_tokens, strict=True))
        return tuple(zip(outputs, class_tokens, extra_tokens, strict=True))


class DINOv3ViTB16SingleScaleBackbone(nn.Module):
    def __init__(self, *, intermediate_layer: int) -> None:
        super().__init__()
        self.body = DinoVisionTransformer()
        self.intermediate_layer = intermediate_layer
        self.proj = nn.Sequential(
            nn.Conv2d(768, 256, kernel_size=1),
            nn.GroupNorm(32, 256),
            nn.ReLU(inplace=True),
        )
        self.out_channels = 256

    def forward(self, x: Tensor) -> OrderedDict[str, Tensor]:
        features = self.body.get_intermediate_layers(
            x,
            n=[self.intermediate_layer],
            reshape=True,
            return_class_token=False,
            return_extra_tokens=False,
            norm=True,
        )
        return OrderedDict([("0", self.proj(features[0]))])


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
        checkpoint = self._load_checkpoint(model_path)
        self._class_names = self._read_class_names(checkpoint)
        self._model_config = self._read_model_config(checkpoint)
        self._validate_class_mappings()
        self._device = self._resolve_device(self.device)
        self._model = self._build_model(
            checkpoint[CHECKPOINT_STATE_DICT_KEY],
        ).to(self._device)
        self._model.eval()
        for parameter in self._model.parameters():
            parameter.requires_grad_(False)
        del checkpoint
        self._predict_lock = Lock()

    @property
    def class_names(self) -> list[str]:
        return list(self._class_names)

    def predict(
        self,
        image_bgr: np.ndarray[Any, np.dtype[np.uint8]],
        confidence: float,
    ) -> tuple[list[Detection], float]:
        height, width = image_bgr.shape[:2]
        image_rgb = np.ascontiguousarray(image_bgr[:, :, ::-1])
        image_tensor = torch.from_numpy(image_rgb)
        image_tensor = image_tensor.permute(2, 0, 1)
        image_tensor = image_tensor.to(self._device, dtype=torch.float32)
        image_tensor = image_tensor.div(255.0)

        started_at = perf_counter()
        with self._predict_lock:
            with torch.inference_mode():
                self._synchronize_if_needed()
                output = self._model([image_tensor])[0]
                self._synchronize_if_needed()
                boxes = output["boxes"].detach().cpu().numpy().copy()
                scores = output["scores"].detach().cpu().numpy().copy()
                labels = output["labels"].detach().cpu().numpy().astype(int).copy()

        inference_ms = (perf_counter() - started_at) * 1000
        records: list[dict[str, Any]] = []

        for xyxy, score, model_label in zip(
            boxes,
            scores,
            labels,
            strict=True,
        ):
            if float(score) < confidence:
                continue

            class_index = int(model_label) - BACKGROUND_LABEL_OFFSET
            if class_index < 0 or class_index >= len(self._class_names):
                continue

            x1, y1, x2, y2 = (float(value) for value in xyxy)
            x1 = min(max(x1, 0.0), float(width))
            y1 = min(max(y1, 0.0), float(height))
            x2 = min(max(x2, 0.0), float(width))
            y2 = min(max(y2, 0.0), float(height))

            if x2 <= x1 or y2 <= y1:
                continue

            raw_name = self._class_names[class_index]
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

    @staticmethod
    def _load_checkpoint(model_path: Path) -> dict[str, Any]:
        checkpoint = torch.load(
            model_path,
            map_location="cpu",
            weights_only=True,
        )
        if not isinstance(checkpoint, dict):
            raise ValueError("DINOv3 checkpoint must be a dictionary")
        if CHECKPOINT_STATE_DICT_KEY not in checkpoint:
            raise ValueError(
                f"DINOv3 checkpoint is missing {CHECKPOINT_STATE_DICT_KEY!r}",
            )
        return checkpoint

    def _read_class_names(self, checkpoint: dict[str, Any]) -> list[str]:
        raw_class_names = checkpoint.get(CHECKPOINT_CLASS_NAMES_KEY)
        if raw_class_names is None:
            return self.class_catalog.class_names
        if not isinstance(raw_class_names, list) or not raw_class_names:
            raise ValueError("DINOv3 checkpoint class_names must be a list")
        return [str(class_name) for class_name in raw_class_names]

    @staticmethod
    def _read_model_config(checkpoint: dict[str, Any]) -> dict[str, Any]:
        config = checkpoint.get(CHECKPOINT_CONFIG_KEY, {})
        if isinstance(config, dict):
            return config
        return {}

    def _validate_class_mappings(self) -> None:
        missing_mappings = {
            class_name.strip().upper()
            for class_name in self._class_names
            if class_name.strip().upper() not in self.class_catalog.class_names
        }
        if missing_mappings:
            missing = ", ".join(sorted(missing_mappings))
            raise ValueError(f"Missing class mappings for: {missing}")

    @staticmethod
    def _resolve_device(device: str) -> torch.device:
        if not device:
            return torch.device("cuda" if torch.cuda.is_available() else "cpu")
        if device.isdigit():
            return torch.device(f"cuda:{device}")
        return torch.device(device)

    def _build_model(self, state_dict: Any) -> FasterRCNN:
        image_min_size = int(
            self._model_config.get(
                "image_min_size",
                min(self.image_size, DEFAULT_IMAGE_MIN_SIZE),
            )
        )
        image_max_size = int(
            self._model_config.get(
                "image_max_size",
                max(self.image_size, DEFAULT_IMAGE_MAX_SIZE),
            )
        )
        intermediate_layer = int(
            self._model_config.get(
                "vit_intermediate_layer",
                DEFAULT_VIT_INTERMEDIATE_LAYER,
            )
        )

        backbone = DINOv3ViTB16SingleScaleBackbone(
            intermediate_layer=intermediate_layer,
        )
        anchor_generator = AnchorGenerator(
            sizes=((16, 32, 64, 128, 256),),
            aspect_ratios=((0.5, 1.0, 2.0),),
        )
        roi_pooler = MultiScaleRoIAlign(
            featmap_names=["0"],
            output_size=7,
            sampling_ratio=2,
        )
        model = FasterRCNN(
            backbone,
            num_classes=len(self._class_names) + BACKGROUND_LABEL_OFFSET,
            min_size=image_min_size,
            max_size=image_max_size,
            image_mean=[0.485, 0.456, 0.406],
            image_std=[0.229, 0.224, 0.225],
            rpn_anchor_generator=anchor_generator,
            box_roi_pool=roi_pooler,
            box_score_thresh=0.0,
        )
        model.load_state_dict(state_dict, strict=True)
        return model

    def _synchronize_if_needed(self) -> None:
        if self._device.type == "cuda":
            torch.cuda.synchronize(self._device)
