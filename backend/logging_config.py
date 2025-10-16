"""Application logging configuration helpers."""

from __future__ import annotations

import logging
from logging.config import dictConfig


DEFAULT_LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {
            "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "standard",
            "level": "INFO",
        }
    },
    "loggers": {
        "backend": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "uvicorn.error": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "uvicorn.access": {"handlers": ["console"], "level": "INFO", "propagate": False},
    },
}


def configure_logging(config: dict | None = None) -> None:
    """Configure application logging using the supplied or default configuration."""

    dictConfig(config or DEFAULT_LOGGING_CONFIG)
    logging.getLogger(__name__).debug("Logging configured", extra={"config": config or DEFAULT_LOGGING_CONFIG})
