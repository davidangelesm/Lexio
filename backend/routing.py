"""Encode monetary values as decimal strings, never binary JSON floats."""

from collections.abc import Callable
from decimal import Decimal
from functools import wraps
from typing import Any

from fastapi.encoders import jsonable_encoder
from fastapi.routing import APIRoute


class ExactMoneyRoute(APIRoute):
    def __init__(self, path: str, endpoint: Callable[..., Any], **options: Any) -> None:
        @wraps(endpoint)
        def encoded(*args: Any, **kwargs: Any) -> Any:
            return jsonable_encoder(
                endpoint(*args, **kwargs),
                custom_encoder={Decimal: lambda value: format(value, ".2f")},
            )

        super().__init__(path, endpoint=encoded, **options)
