"""Regenera docs/esquema.sql desde backend/blissens.db:  python scripts/esquema.py"""
import sqlite3
from pathlib import Path

RAIZ = Path(__file__).parents[1]
SQL = RAIZ / "docs" / "esquema.sql"
cuerpo = SQL.read_text(encoding="utf-8").split("\n\n", 1)[0]  # conserva la cabecera
filas = [s for (s,) in sqlite3.connect(RAIZ / "backend" / "blissens.db").execute("SELECT sql FROM sqlite_master WHERE sql NOT NULL ORDER BY type DESC, name")]
SQL.write_text(cuerpo + "\n\n" + ";\n\n".join(filas) + ";\n", encoding="utf-8", newline="\n")
print(f"docs/esquema.sql: {len(filas)} sentencias")
