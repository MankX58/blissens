"""Sesión del panel para FastAPI.

El inicio de sesión lo hace Better Auth (auth/auth.ts, servidor Node) y guarda la sesión en backend/blissens.db.
Aquí se valida la misma cookie: firma HMAC con BETTER_AUTH_SECRET + sesión vigente + cuenta activa.

    from fastapi import Depends, FastAPI
    from sesion import requiere_rol, usuario_actual

    @app.get("/api/indicadores")
    def indicadores(u = Depends(requiere_rol("direccion"))): ...

    @app.get("/api/yo")
    def yo(u = Depends(usuario_actual)): return u
"""

import base64
import hashlib
import hmac
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote

from fastapi import HTTPException, Request

BASE = Path(__file__).with_name("blissens.db")
COOKIES = ("__Secure-better-auth.session_token", "better-auth.session_token")  # la primera con HTTPS


def usuario_de_cookie(valor: str | None, secreto: str, base: Path = BASE) -> dict | None:
    """Devuelve {id, nombre, email, rol} si la cookie es auténtica y la sesión sigue vigente; si no, None."""
    if not valor or not secreto:
        return None
    token, _, firma = unquote(valor).rpartition(".")
    esperada = base64.b64encode(hmac.new(secreto.encode(), token.encode(), hashlib.sha256).digest()).decode()
    if not token or not hmac.compare_digest(firma, esperada):
        return None
    with sqlite3.connect(base) as db:
        fila = db.execute(
            """SELECT u.id, u.name, u.email, u.role, u.banned, u.banExpires, s.expiresAt
               FROM session s JOIN user u ON u.id = s.userId WHERE s.token = ?""",
            (token,),
        ).fetchone()
    if not fila:
        return None
    uid, nombre, email, rol, bloqueado, fin_bloqueo, vence = fila
    ahora = datetime.now(timezone.utc)
    if datetime.fromisoformat(vence) <= ahora:
        return None
    if bloqueado and (not fin_bloqueo or datetime.fromisoformat(fin_bloqueo) > ahora):
        return None
    return {"id": uid, "nombre": nombre, "email": email, "rol": rol}


def usuario_actual(request: Request) -> dict:
    valor = next((request.cookies[c] for c in COOKIES if c in request.cookies), None)
    u = usuario_de_cookie(valor, os.environ.get("BETTER_AUTH_SECRET", ""))
    if not u:
        raise HTTPException(401, "Inicia sesión")
    return u


def requiere_rol(*roles: str):
    """Dependencia que deja pasar a dirección y a los roles indicados (igual que puedeVer en src/lib/roles.ts)."""

    def comprobar(request: Request) -> dict:
        u = usuario_actual(request)
        if u["rol"] != "direccion" and u["rol"] not in roles:
            raise HTTPException(403, "Tu rol no tiene acceso a esta sección")
        return u

    return comprobar


# ---------- autoprueba:  python backend/sesion.py ----------
if __name__ == "__main__":
    import tempfile
    from urllib.parse import quote

    SECRETO = "secreto-de-prueba"

    def cookie(token: str, secreto: str = SECRETO) -> str:
        return token + "." + base64.b64encode(hmac.new(secreto.encode(), token.encode(), hashlib.sha256).digest()).decode()

    base = Path(tempfile.mkdtemp()) / "b.db"
    with sqlite3.connect(base) as db:
        db.executescript("""
            CREATE TABLE user (id TEXT, name TEXT, email TEXT, role TEXT, banned INTEGER, banExpires DATE);
            CREATE TABLE session (token TEXT, userId TEXT, expiresAt DATE);
            INSERT INTO user VALUES ('u1', 'Ana', 'ana@x.co', 'mercadeo', 0, NULL), ('u2', 'Bea', 'bea@x.co', 'auxiliar', 1, NULL);
            INSERT INTO session VALUES ('vigente', 'u1', '2999-01-01T00:00:00.000Z'), ('vencida', 'u1', '2000-01-01T00:00:00.000Z'),
                                       ('bloqueada', 'u2', '2999-01-01T00:00:00.000Z');
        """)
    assert usuario_de_cookie(cookie("vigente"), SECRETO, base) == {"id": "u1", "nombre": "Ana", "email": "ana@x.co", "rol": "mercadeo"}
    assert usuario_de_cookie(quote(cookie("vigente"), safe=""), SECRETO, base)  # el navegador manda la firma URL-encoded
    assert usuario_de_cookie(cookie("vigente", "otro"), SECRETO, base) is None  # firma falsa
    assert usuario_de_cookie("vigente", SECRETO, base) is None  # sin firma
    assert usuario_de_cookie(cookie("vencida"), SECRETO, base) is None
    assert usuario_de_cookie(cookie("bloqueada"), SECRETO, base) is None
    assert usuario_de_cookie(cookie("no-existe"), SECRETO, base) is None

    print("ok")
