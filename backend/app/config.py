from pathlib import Path

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = BACKEND_DIR.parent
ENV_FILE = BACKEND_DIR / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str
    app_version: str
    api_prefix: str
    health_route: str
    runtime_config_route: str
    predict_route: str
    docs_url: str
    openapi_url: str

    model_path: Path
    class_mapping_path: Path
    model_device: str
    image_size: int = Field(gt=0)
    min_confidence: float = Field(ge=0.0, le=1.0)
    max_confidence: float = Field(ge=0.0, le=1.0)
    default_confidence: float = Field(ge=0.0, le=1.0)
    max_upload_mb: int = Field(gt=0)
    max_image_pixels: int = Field(gt=0)
    inference_time_decimals: int = Field(ge=0, le=6)
    allowed_image_types_csv: str

    cors_origins_csv: str
    cors_allow_credentials: bool
    cors_allow_methods_csv: str
    cors_allow_headers_csv: str

    server_host: str
    server_port: int = Field(ge=1, le=65535)
    server_reload: bool
    server_workers: int = Field(ge=1)

    @field_validator("model_path", "class_mapping_path", mode="after")
    @classmethod
    def resolve_repository_path(cls, value: Path) -> Path:
        if value.is_absolute():
            return value
        return (REPOSITORY_ROOT / value).resolve()

    @model_validator(mode="after")
    def validate_server_mode(self) -> "Settings":
        if self.server_reload and self.server_workers != 1:
            raise ValueError("SERVER_RELOAD=true requires SERVER_WORKERS=1")
        if not (
            self.min_confidence
            <= self.default_confidence
            <= self.max_confidence
        ):
            raise ValueError(
                "DEFAULT_CONFIDENCE must be between "
                "MIN_CONFIDENCE and MAX_CONFIDENCE"
            )
        return self

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    @staticmethod
    def _split_csv(value: str) -> list[str]:
        return [item.strip() for item in value.split(",") if item.strip()]

    @property
    def cors_origins(self) -> list[str]:
        return self._split_csv(self.cors_origins_csv)

    @property
    def cors_allow_methods(self) -> list[str]:
        return self._split_csv(self.cors_allow_methods_csv)

    @property
    def cors_allow_headers(self) -> list[str]:
        return self._split_csv(self.cors_allow_headers_csv)

    @property
    def allowed_image_types(self) -> list[str]:
        return self._split_csv(self.allowed_image_types_csv)

    @staticmethod
    def _join_route(prefix: str, route: str) -> str:
        return f"/{prefix.strip('/')}/{route.strip('/')}"

    @property
    def health_path(self) -> str:
        return self._join_route(self.api_prefix, self.health_route)

    @property
    def runtime_config_path(self) -> str:
        return self._join_route(self.api_prefix, self.runtime_config_route)

    @property
    def predict_path(self) -> str:
        return self._join_route(self.api_prefix, self.predict_route)


settings = Settings()
