import os
from datetime import datetime, timedelta, timezone
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from models import User
from pwdlib import PasswordHash
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db

passwords = PasswordHash.recommended()
bearer = HTTPBearer(auto_error=False)
Db = Annotated[Session, Depends(get_db)]


def secret() -> str:
    value = os.getenv("JWT_SECRET", "")
    if len(value) < 32 or value.startswith("REEMPLAZAR"):
        raise RuntimeError("Configura JWT_SECRET con al menos 32 caracteres aleatorios")
    return value


def token(user: User) -> str:
    return jwt.encode(
        {
            "sub": str(user.id),
            "tenant_id": user.tenant_id,
            "iat": datetime.now(timezone.utc),
            "exp": datetime.now(timezone.utc)
            + timedelta(minutes=int(os.getenv("JWT_MINUTES", "60"))),
            "iss": "lexio",
            "aud": "lexio-desktop",
        },
        secret(),
        algorithm="HS256",
    )


def current_user(
    db: Db, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]
) -> User:
    try:
        if credentials is None:
            raise ValueError("missing")
        payload = jwt.decode(
            credentials.credentials,
            secret(),
            algorithms=["HS256"],
            issuer="lexio",
            audience="lexio-desktop",
            options={"require": ["sub", "tenant_id", "exp", "iat"]},
        )
        user = db.scalar(
            select(User).where(
                User.id == int(payload["sub"]),
                User.tenant_id == int(payload["tenant_id"]),
                User.active.is_(True),
            )
        )
        if user is None:
            raise ValueError("inactive")
        return user
    except (jwt.InvalidTokenError, ValueError, TypeError, KeyError):
        raise HTTPException(
            401, "Sesión inválida o vencida", headers={"WWW-Authenticate": "Bearer"}
        ) from None


Actor = Annotated[User, Depends(current_user)]


def admin(user: User) -> None:
    if user.role != "admin":
        raise HTTPException(403, "Función exclusiva del administrador financiero")
