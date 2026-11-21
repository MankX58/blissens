import type { DatabaseSync } from 'node:sqlite';

// Los turnos libres se llaman "cupos" y la tabla "agenda_libre" (antes huecos_agenda / ofertas_hueco / hueco_id).
// SQLite actualiza solas las claves foráneas que apuntan a las tablas y columnas renombradas. Idempotente.
export function renombrarCupos(db: DatabaseSync) {
  const existe = (t: string) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(t);
  const tiene = (t: string, c: string) => (db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).some((x) => x.name === c);
  if (existe('huecos_agenda') && !existe('agenda_libre')) db.exec('ALTER TABLE huecos_agenda RENAME TO agenda_libre');
  if (existe('ofertas_hueco') && !existe('ofertas_cupo')) db.exec('ALTER TABLE ofertas_hueco RENAME TO ofertas_cupo');
  if (tiene('ofertas_cupo', 'hueco_id')) db.exec('ALTER TABLE ofertas_cupo RENAME COLUMN hueco_id TO cupo_id');
  if (tiene('contactos_seguimiento', 'hueco_id')) db.exec('ALTER TABLE contactos_seguimiento RENAME COLUMN hueco_id TO cupo_id');
}
