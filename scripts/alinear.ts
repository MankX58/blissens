// Alinea backend/blissens.db con las reglas del panel web.
// Usa el mismo lector de Excel que la app (src/lib/excel.ts) como fuente de verdad, así la base y la app dan las mismas cifras.
//
//   npx tsx scripts/alinear.ts            (lee public/datos/*.xlsx y actualiza backend/blissens.db)
//
// Es idempotente: se puede correr después de cada carga de Excel.
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { leerArchivos } from '../src/lib/excel';
import { renombrarCupos } from './migrar';
import { diasEntre, fechaQueToca, pasoActual, semaforo, tocaHoy } from '../src/lib/reglas';

const BASE = 'backend/blissens.db';
const EXCEL = ['agenda-citas-estados.xlsx', 'agenda-citas-detalle.xlsx', 'arancel-precios.xlsx', 'guiones.xlsx'];

const t0 = Date.now();
const carga = await leerArchivos(
  EXCEL.map((n) => {
    const b = readFileSync(`public/datos/${n}`);
    return { nombre: n, buffer: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer };
  })
);
const corte = carga.fechaCorte;
const db = new DatabaseSync(BASE);
db.exec('PRAGMA foreign_keys = ON');
renombrarCupos(db);

// ---------- 1. esquema: columnas y tablas que usa la app ----------
const columnas = (tabla: string) => new Set((db.prepare(`PRAGMA table_info(${tabla})`).all() as { name: string }[]).map((c) => c.name));
const agregar = (tabla: string, col: string, def: string) => {
  if (!columnas(tabla).has(col)) db.exec(`ALTER TABLE ${tabla} ADD COLUMN ${col} ${def}`);
};
agregar('pacientes', 'fallos_seguidos', 'INTEGER NOT NULL DEFAULT 0'); // define el riesgo
agregar('pacientes', 'ultima_atendida', 'DATE');
agregar('pacientes', 'apoderado', 'VARCHAR(200)');
agregar('ofertas_cupo', 'rechazo', 'BOOLEAN NOT NULL DEFAULT 0'); // "No puede" en la agenda libre
agregar('agenda_libre', 'confirmado_el', 'DATE'); // confirmación 24 h antes
agregar('cargas_excel', 'fecha_corte', 'DATE'); // fecha a la que se calcularon semáforo y "toca hoy"
// quién hizo cada acción: user.id de Better Auth (auth/auth.ts); FastAPI lo llena con el usuario de la sesión
const QUIEN = 'TEXT REFERENCES user (id) ON DELETE SET NULL';
for (const t of ['contactos_seguimiento', 'notas_paciente', 'campanas', 'ofertas_cupo', 'cargas_excel']) agregar(t, 'registrado_por', QUIEN);
agregar('agenda_libre', 'asignado_por', QUIEN); // quien asignó el cupo (va con asignado_el)
db.exec(`
  CREATE TABLE IF NOT EXISTS etiquetas_paciente (
    numero_paciente INTEGER NOT NULL,
    etiqueta VARCHAR(40) NOT NULL,
    PRIMARY KEY (numero_paciente, etiqueta),
    FOREIGN KEY (numero_paciente) REFERENCES pacientes (numero_paciente) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS configuracion (
    clave VARCHAR(60) NOT NULL PRIMARY KEY,
    valor TEXT NOT NULL
  );
`);

// ---------- 2. pacientes con las reglas de la app ----------
const actualizar = db.prepare(`
  UPDATE pacientes SET
    antiguedad_actual = ?, perfil_comercial = ?, caso_seguimiento = ?, estado_seguimiento = ?,
    profesional_principal = ?, ultima_fecha_cita = ?, ultimo_estado_cita = ?, ultimo_comentario = ?,
    telefono_normalizado = ?, sin_celular = ?, email = ?, apoderado = ?,
    fallos_historicos = ?, fallos_seguidos = ?, ultima_atendida = ?, score_riesgo = ?, nivel_riesgo = ?, requiere_doble_confirmacion = ?,
    es_vip = ?, es_control_limpieza = ?, pausa_mayor_30_dias = ?,
    dias_desde_evento = ?, semaforo = ?, paso_protocolo_actual = ?, fecha_proximo_contacto = ?, toca_hoy = ?,
    valor_estimado_cop = ?, valor_estimado_fuente = ?, accion_arancel_referencia = ?
  WHERE numero_paciente = ?`);
const borrarEtiquetas = db.prepare('DELETE FROM etiquetas_paciente');
const ponerEtiqueta = db.prepare('INSERT INTO etiquetas_paciente (numero_paciente, etiqueta) VALUES (?, ?)');
const guardar = db.prepare('INSERT INTO configuracion (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor');

let actualizados = 0;
const sinFila: string[] = [];
db.exec('BEGIN');
try {
  borrarEtiquetas.run();
  for (const p of carga.pacientes) {
    const num = Number(p.idPaciente.slice(1));
    const r = actualizar.run(
      p.antiguedad.toLowerCase(),
      p.segmento,
      p.grupo === 4 ? null : p.caso,
      p.estado,
      p.especialista,
      p.ultimaCita?.fecha ?? null,
      p.ultimaCita?.estado ?? null,
      p.tratamiento,
      p.telefono || null,
      p.telefono ? 0 : 1,
      p.email || null,
      p.apoderado || null,
      p.fallosHistoricos,
      p.fallosSeguidos,
      p.ultimaAtendida ?? null,
      Math.min(100, Math.round((p.fallosSeguidos * 100) / 3)), // % del umbral de doble confirmación (3 seguidas = 100)
      p.nivelRiesgo.toLowerCase(),
      p.fallosSeguidos >= 3 ? 1 : 0,
      p.etiquetas.includes('VIP') ? 1 : 0,
      p.caso === 'limpieza' ? 1 : 0,
      p.caso === 'pausa' && p.fechaEvento <= corte ? 1 : 0,
      diasEntre(p.fechaEvento, corte), // negativo = el control aún no vence
      semaforo(p, corte),
      pasoActual(p, corte),
      fechaQueToca(p, corte),
      tocaHoy(p, corte) ? 1 : 0,
      p.valor,
      p.valorReferencia ? `arancel_${p.valorReferencia.fuente === 'comentario' ? 'comentario' : 'tipo_cita'}` : 'sin_estimacion',
      p.valorReferencia?.acciones.join(' + ').slice(0, 200) ?? null,
      num
    );
    if (Number(r.changes)) actualizados++;
    else sinFila.push(p.idPaciente);
    for (const e of p.etiquetas) ponerEtiqueta.run(num, e);
  }
  guardar.run('asesora', 'Isabel Cristina');
  guardar.run('fecha_corte', corte);
  guardar.run('regla_riesgo', 'Alto: 3+ citas seguidas sin asistir desde la última atendida. Medio: 1-2 seguidas o 3+ en total. Bajo: el resto.');
  guardar.run('regla_semaforo', 'Rojo: 0-3 días, VIP o riesgo alto. Amarillo: 4-14 días (día 7). Verde: 15+ días (rescate) o limpieza preventiva.');
  db.prepare(
    `INSERT INTO cargas_excel (fecha_carga, duracion_ms, total_citas, total_pacientes, citas_enriquecidas_octubre, guiones_cargados, acciones_arancel_cargadas, estado, fecha_corte)
     VALUES (datetime('now'), ?, ?, ?, ?, 24, ?, 'alineada_con_app', ?)`
  ).run(Date.now() - t0, carga.citas.length, carga.pacientes.length, carga.citas.filter((c) => c.hora).length, carga.precios, corte);
  db.exec('COMMIT');
} catch (e) {
  db.exec('ROLLBACK');
  throw e;
}

// ---------- 3. verificación: la base debe dar las mismas cifras que la app ----------
const uno = (sql: string) => Object.values(db.prepare(sql).get() as object)[0] as number;
const app = {
  riesgoAlto: carga.pacientes.filter((p) => p.nivelRiesgo === 'Alto').length,
  tocaHoy: carga.pacientes.filter((p) => tocaHoy(p, corte)).length,
  enPausa: carga.pacientes.filter((p) => p.estado === 'pendiente').reduce((s, p) => s + p.valor, 0),
  activos: carga.pacientes.filter((p) => p.estado === 'activo').length,
  pausa: carga.pacientes.filter((p) => p.caso === 'pausa' && p.grupo === 3).length,
};
const base = {
  riesgoAlto: uno("SELECT count(*) FROM pacientes WHERE nivel_riesgo = 'alto'"),
  tocaHoy: uno('SELECT count(*) FROM pacientes WHERE toca_hoy'),
  enPausa: uno("SELECT sum(valor_estimado_cop) FROM pacientes WHERE estado_seguimiento = 'pendiente'"),
  activos: uno("SELECT count(*) FROM pacientes WHERE estado_seguimiento = 'activo'"),
  pausa: uno("SELECT count(*) FROM pacientes WHERE caso_seguimiento = 'pausa'"),
};
const segmentos = db.prepare('SELECT segmento_cartera s, count(*) n FROM pacientes GROUP BY 1 ORDER BY 1').all();
const ok = JSON.stringify(app) === JSON.stringify(base) && !sinFila.length;
console.log({ corte, actualizados, sinFila, app, base, segmentos, etiquetas: uno('SELECT count(*) FROM etiquetas_paciente') });
console.log(ok ? '✓ La base quedó alineada con la app' : '✗ Hay diferencias entre la base y la app');
if (!ok) process.exit(1);
