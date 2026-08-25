import uvicorn

from backend.app.config import settings


if __name__ == "__main__":
    uvicorn.run(
        "backend.app.main:app",
        host=settings.server_host,
        port=settings.server_port,
        reload=settings.server_reload,
        workers=settings.server_workers,
    )
