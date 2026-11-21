// Combina backend/blissens.db (base operativa del panel) con blissens_odontologia.db (modelo normalizado de origen).
//
//   npx tsx backend/combinar.ts [ruta/a/blissens_odontologia.db]
//   npx tsx backend/alinear.ts          (después: vuelve a verificar que la base coincide con la app)
//
// Qué entra: catálogos (profesionales, especialidades, sucursales, sillones, usuarios, estados y eventos de cita),
// tratamientos, trazabilidad de eventos por cita, apoderados, categorías del arancel y datos extra de pacientes.
// Qué NO entra: el riesgo y la antigüedad calculados en la base de origen, porque usan reglas distintas a las del panel
// (las columnas calculadas las mantiene backend/alinear.ts con el mismo lector de Excel que la app).
//
// Es idempotente: actualiza por llave, nunca borra filas de la base operativa.
import { DatabaseSync } from 'node:sqlite';
import { FALLOS, FRICCION, FRICCION_KPI } from '../src/lib/excel';
import { renombrarCupos } from './migrar';

const ORIGEN = process.argv[2] ?? 'backend/blissens_odontologia.db';
const DESTINO = 'backend/blissens.db';
const o = new DatabaseSync(ORIGEN, { readOnly: true });
const d = new DatabaseSync(DESTINO);
d.exec('PRAGMA foreign_keys = ON');
renombrarCupos(d);

type Fila = Record<string, string | number | null>;
const todo = (sql: string) => o.prepare(sql).all() as Fila[];
const columnas = (t: string) => new Set((d.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name));
const agregar = (t: string, col: string, def: string) => {
  if (!columnas(t).has(col)) d.exec(`ALTER TABLE ${t} ADD COLUMN ${col} ${def}`);
};
// inserta o actualiza por llave primaria (sin REPLACE, que borraría en cascada)
function upsert(tabla: string, llave: string[], filas: Fila[]) {
  if (!filas.length) return 0;
  const cols = Object.keys(filas[0]);
  const resto = cols.filter((c) => !llave.includes(c));
  const st = d.prepare(
    `INSERT INTO ${tabla} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})
     ON CONFLICT (${llave.join(', ')}) DO ${resto.length ? `UPDATE SET ${resto.map((c) => `${c} = excluded.${c}`).join(', ')}` : 'NOTHING'}`
  );
  for (const f of filas) st.run(...cols.map((c) => f[c]));
  return filas.length;
}

// ---------- 1. tablas de referencia ----------
d.exec(`
  CREATE TABLE IF NOT EXISTS especialidades (
    id_especialidad INTEGER NOT NULL PRIMARY KEY,
    codigo VARCHAR(10) NOT NULL UNIQUE,
    descripcion VARCHAR(120)
  );
  CREATE TABLE IF NOT EXISTS profesionales (
    id_profesional INTEGER NOT NULL PRIMARY KEY,
    nombre_mostrar VARCHAR(120) NOT NULL UNIQUE,            -- igual que citas.profesional / pacientes.profesional_principal
    nombres VARCHAR(80) NOT NULL,
    apellidos VARCHAR(80) NOT NULL,
    id_especialidad INTEGER NOT NULL REFERENCES especialidades (id_especialidad),
    activo BOOLEAN NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS sucursales (
    id_sucursal INTEGER NOT NULL PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL UNIQUE,
    direccion VARCHAR(200)
  );
  CREATE TABLE IF NOT EXISTS sillones (
    id_sillon INTEGER NOT NULL PRIMARY KEY,
    id_sucursal INTEGER NOT NULL REFERENCES sucursales (id_sucursal),
    nombre VARCHAR(50) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT 1,
    UNIQUE (id_sucursal, nombre)
  );
  CREATE TABLE IF NOT EXISTS usuarios_sistema (
    id_usuario INTEGER NOT NULL PRIMARY KEY,
    nombre_usuario VARCHAR(80) NOT NULL UNIQUE
  );
  -- Estados del software con la regla de negocio que cumple cada uno (así el backend no la escribe a mano)
  CREATE TABLE IF NOT EXISTS estados_cita (
    id_estado INTEGER NOT NULL PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL UNIQUE,                     -- igual que citas.estado_actual
    es_atendida BOOLEAN NOT NULL DEFAULT 0,
    es_friccion BOOLEAN NOT NULL DEFAULT 0,                 -- 6 estados: deja al paciente "sin reagendar" (segmentación)
    es_friccion_kpi BOOLEAN NOT NULL DEFAULT 0,             -- 4 estados: tasa de fricción del SRS (52,1 %)
    cuenta_como_fallo BOOLEAN NOT NULL DEFAULT 0,           -- 5 estados: suman al riesgo
    es_confirmacion BOOLEAN NOT NULL DEFAULT 0              -- confirmada o notificada: paciente activo
  );
  CREATE TABLE IF NOT EXISTS eventos_cita (
    id_evento INTEGER NOT NULL PRIMARY KEY,
    codigo VARCHAR(60) NOT NULL UNIQUE,
    descripcion VARCHAR(120) NOT NULL                       -- columna Sí/No del Excel "Agenda citas y estados"
  );
  CREATE TABLE IF NOT EXISTS cita_eventos (
    numero_cita INTEGER NOT NULL REFERENCES citas (numero_cita) ON DELETE CASCADE,
    id_evento INTEGER NOT NULL REFERENCES eventos_cita (id_evento),
    activo BOOLEAN NOT NULL DEFAULT 1,
    PRIMARY KEY (numero_cita, id_evento)
  );
  CREATE TABLE IF NOT EXISTS apoderados (
    id_apoderado INTEGER NOT NULL PRIMARY KEY,
    numero_identificacion VARCHAR(30) UNIQUE,
    nombre_completo VARCHAR(200) NOT NULL,
    telefono VARCHAR(30),
    celular VARCHAR(30)
  );
  CREATE TABLE IF NOT EXISTS tratamientos (
    numero_tratamiento INTEGER NOT NULL PRIMARY KEY,        -- # Tratamiento del software (citas.numero_tratamiento)
    numero_paciente INTEGER NOT NULL REFERENCES pacientes (numero_paciente) ON DELETE CASCADE,
    id_especialidad INTEGER NOT NULL REFERENCES especialidades (id_especialidad),
    tipo_atencion VARCHAR(20) NOT NULL CHECK (tipo_atencion IN ('Diagnóstico', 'Tratamiento')),
    convenio_tratamiento VARCHAR(80),
    fecha_generacion DATE
  );
  CREATE TABLE IF NOT EXISTS aranceles (
    id_arancel INTEGER NOT NULL PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL UNIQUE
  );
  CREATE TABLE IF NOT EXISTS categorias_arancel (
    id_categoria INTEGER NOT NULL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL UNIQUE
  );
`);

// ---------- 2. columnas nuevas en las tablas existentes ----------
for (const [col, def] of [
  ['nombres', 'VARCHAR(100)'],
  ['apellidos', 'VARCHAR(100)'],
  ['numero_identificacion', 'VARCHAR(30)'],
  ['numero_interno', 'VARCHAR(30)'],
  ['fecha_nacimiento', 'DATE'],
  ['telefono_secundario', 'VARCHAR(30)'], // campo "Teléfono" del software: puede ser fijo o un segundo celular
  ['convenio_paciente', 'VARCHAR(80)'],
  ['observaciones_medicas', 'TEXT'],
  ['habilitado', 'BOOLEAN NOT NULL DEFAULT 1'],
  ['id_apoderado', 'INTEGER REFERENCES apoderados (id_apoderado) ON DELETE SET NULL'],
  ['total_citas', 'INTEGER NOT NULL DEFAULT 0'],
  ['total_atendidas', 'INTEGER NOT NULL DEFAULT 0'],
  ['numero_ultima_cita', 'INTEGER REFERENCES citas (numero_cita) ON DELETE SET NULL'],
]) agregar('pacientes', col, def);
for (const [col, def] of [
  ['id_profesional', 'INTEGER REFERENCES profesionales (id_profesional)'],
  ['id_estado', 'INTEGER REFERENCES estados_cita (id_estado)'],
  ['id_sucursal', 'INTEGER REFERENCES sucursales (id_sucursal)'],
  ['id_sillon', 'INTEGER REFERENCES sillones (id_sillon)'],
  ['id_usuario_agendo', 'INTEGER REFERENCES usuarios_sistema (id_usuario)'],
  ['motivo_atencion', 'TEXT'],
  ['fecha_creacion_cita', 'DATETIME'],
]) agregar('citas', col, def);
agregar('acciones_arancel', 'id_categoria', 'INTEGER REFERENCES categorias_arancel (id_categoria)');
agregar('acciones_arancel', 'id_arancel', 'INTEGER REFERENCES aranceles (id_arancel)');
agregar('agenda_libre', 'id_profesional', 'INTEGER REFERENCES profesionales (id_profesional)');
agregar('agenda_libre', 'id_sillon', 'INTEGER REFERENCES sillones (id_sillon)');

// ---------- 3. datos ----------
const titulo = (s: string) => s.replace(/\b(\p{L})(\p{L}*)/gu, (_, a: string, b: string) => a.toUpperCase() + b.toLowerCase());
const mostrar = (n: string, a: string) => (/olarte/i.test(a) ? 'Dr. Juan Manuel Olarte' : /lopez/i.test(a) ? 'Dra. Sara López' : `${n} ${a}`);
const conteo: Record<string, number> = {};
d.exec('BEGIN');
try {
  conteo.especialidades = upsert('especialidades', ['id_especialidad'], todo('SELECT id_especialidad, codigo_especialidad AS codigo, descripcion FROM especialidades'));
  conteo.profesionales = upsert(
    'profesionales',
    ['id_profesional'],
    todo('SELECT id_profesional, nombres, apellidos, id_especialidad, activo FROM profesionales').map((r) => ({
      id_profesional: r.id_profesional,
      nombre_mostrar: mostrar(String(r.nombres), String(r.apellidos)),
      nombres: r.nombres,
      apellidos: r.apellidos === 'Lopez' ? 'López' : r.apellidos,
      id_especialidad: r.id_especialidad,
      activo: r.activo,
    }))
  );
  conteo.sucursales = upsert(
    'sucursales',
    ['id_sucursal'],
    todo('SELECT id_sucursal, nombre_sucursal AS nombre FROM sucursales').map((r) => ({ ...r, direccion: 'El Tesoro, Torre Médica 2, consultorio 1157' }))
  );
  conteo.sillones = upsert('sillones', ['id_sillon'], todo('SELECT id_sillon, id_sucursal, nombre_sillon AS nombre, activo FROM sillones'));
  conteo.usuarios_sistema = upsert('usuarios_sistema', ['id_usuario'], todo('SELECT id_usuario, nombre_usuario FROM usuarios_sistema'));
  conteo.estados_cita = upsert(
    'estados_cita',
    ['id_estado'],
    todo('SELECT id_estado, nombre_estado AS nombre FROM catalogo_estados_cita').map((r) => {
      const n = String(r.nombre);
      return {
        ...r,
        es_atendida: n === 'Atendido' ? 1 : 0,
        es_friccion: FRICCION.includes(n) ? 1 : 0,
        es_friccion_kpi: FRICCION_KPI.includes(n) ? 1 : 0,
        cuenta_como_fallo: FALLOS.includes(n) ? 1 : 0,
        es_confirmacion: n !== 'Atendido' && !FRICCION.includes(n) ? 1 : 0,
      };
    })
  );
  conteo.eventos_cita = upsert('eventos_cita', ['id_evento'], todo('SELECT id_evento, codigo_evento AS codigo, descripcion FROM catalogo_eventos_cita'));
  conteo.apoderados = upsert('apoderados', ['id_apoderado'], todo('SELECT id_apoderado, numero_identificacion, nombre_completo, telefono, celular FROM apoderados'));
  conteo.aranceles = upsert('aranceles', ['id_arancel'], todo('SELECT id_arancel, nombre_arancel AS nombre FROM aranceles'));
  conteo.categorias_arancel = upsert('categorias_arancel', ['id_categoria'], todo('SELECT id_categoria, nombre_categoria AS nombre FROM categorias_arancel'));
  conteo.tratamientos = upsert(
    'tratamientos',
    ['numero_tratamiento'],
    todo('SELECT id_tratamiento AS numero_tratamiento, id_paciente AS numero_paciente, id_especialidad, tipo_atencion, convenio_tratamiento, fecha_generacion FROM tratamientos')
  );
  conteo.cita_eventos = upsert('cita_eventos', ['numero_cita', 'id_evento'], todo('SELECT id_cita AS numero_cita, id_evento, activo FROM cita_eventos_trazabilidad'));

  // pacientes: solo datos de ficha (lo calculado lo deja alinear.ts como lo calcula la app)
  const p = d.prepare(`UPDATE pacientes SET nombres = ?, apellidos = ?, numero_identificacion = ?, numero_interno = ?, fecha_nacimiento = ?,
    telefono_secundario = ?, convenio_paciente = ?, observaciones_medicas = ?, habilitado = ?, id_apoderado = ?,
    email = COALESCE(email, ?), tipo_paciente = COALESCE(tipo_paciente, ?) WHERE numero_paciente = ?`);
  const fechaValida = (f: unknown) => (typeof f === 'string' && /^(19|20)\d\d-\d\d-\d\d$/.test(f) && !f.startsWith('1901') ? f : null);
  for (const r of todo('SELECT * FROM pacientes'))
    p.run(
      titulo(String(r.nombres).replace(/\s+/g, ' ').trim()),
      titulo(String(r.apellidos).replace(/\s+/g, ' ').trim()),
      r.numero_identificacion,
      r.numero_interno,
      fechaValida(r.fecha_nacimiento),
      r.telefono ? String(r.telefono).replace(/\D/g, '') || null : null,
      r.convenio_paciente,
      r.observaciones_medicas,
      r.habilitado,
      r.id_apoderado,
      r.email,
      r.tipo_paciente,
      r.id_paciente
    );
  conteo.pacientes = Number((d.prepare('SELECT count(*) n FROM pacientes WHERE nombres IS NOT NULL').get() as Fila).n);

  // citas: llaves a los catálogos
  const c = d.prepare(`UPDATE citas SET id_profesional = ?, id_estado = ?, id_sucursal = ?, id_sillon = ?, id_usuario_agendo = ?,
    motivo_atencion = ?, fecha_creacion_cita = ? WHERE numero_cita = ?`);
  for (const r of todo('SELECT * FROM citas'))
    c.run(r.id_profesional, r.id_estado_actual, r.id_sucursal, r.id_sillon, r.id_usuario_agendo, r.motivo_atencion, r.fecha_creacion_cita, r.id_cita);

  d.exec(`
    UPDATE acciones_arancel SET
      id_categoria = (SELECT id_categoria FROM categorias_arancel WHERE nombre = acciones_arancel.categoria),
      id_arancel = (SELECT id_arancel FROM aranceles WHERE nombre = acciones_arancel.nombre_arancel);
    UPDATE pacientes SET
      total_citas = (SELECT count(*) FROM citas WHERE citas.numero_paciente = pacientes.numero_paciente),
      total_atendidas = (SELECT count(*) FROM citas WHERE citas.numero_paciente = pacientes.numero_paciente AND estado_actual = 'Atendido'),
      numero_ultima_cita = (SELECT numero_cita FROM citas WHERE citas.numero_paciente = pacientes.numero_paciente
                            ORDER BY fecha_cita DESC, orden_fila_excel ASC LIMIT 1);
    UPDATE agenda_libre SET
      id_profesional = (SELECT id_profesional FROM profesionales WHERE nombre_mostrar = agenda_libre.profesional),
      id_sillon = (SELECT id_sillon FROM sillones WHERE nombre = agenda_libre.sillon);
  `);
  d.exec('COMMIT');
} catch (e) {
  d.exec('ROLLBACK');
  throw e;
}

// ---------- 4. validaciones: las dos fuentes deben contar la misma historia ----------
const n = (sql: string) => Number(Object.values(d.prepare(sql).get() as Fila)[0]);
const chequeos: [string, number][] = [
  ['citas sin profesional o estado', n('SELECT count(*) FROM citas WHERE id_profesional IS NULL OR id_estado IS NULL')],
  ['estado texto ≠ catálogo', n('SELECT count(*) FROM citas c JOIN estados_cita e ON e.id_estado = c.id_estado WHERE e.nombre <> c.estado_actual')],
  ['profesional texto ≠ catálogo', n('SELECT count(*) FROM citas c JOIN profesionales p ON p.id_profesional = c.id_profesional WHERE p.nombre_mostrar <> c.profesional')],
  ['citas con tratamiento inexistente', n('SELECT count(*) FROM citas c LEFT JOIN tratamientos t ON t.numero_tratamiento = c.numero_tratamiento WHERE t.numero_tratamiento IS NULL')],
  ['tratamiento de otro paciente', n('SELECT count(*) FROM citas c JOIN tratamientos t ON t.numero_tratamiento = c.numero_tratamiento WHERE t.numero_paciente <> c.numero_paciente')],
  ['tipo de atención distinto', n('SELECT count(*) FROM citas c JOIN tratamientos t ON t.numero_tratamiento = c.numero_tratamiento WHERE t.tipo_atencion <> c.tipo_atencion')],
  ['última cita ≠ la que usa la app', n('SELECT count(*) FROM pacientes p JOIN citas c ON c.numero_cita = p.numero_ultima_cita WHERE c.fecha_cita <> p.ultima_fecha_cita OR c.estado_actual <> p.ultimo_estado_cita')],
  ['celular distinto entre fuentes', 0],
  ['acciones sin categoría', n('SELECT count(*) FROM acciones_arancel WHERE id_categoria IS NULL OR id_arancel IS NULL')],
  ['fricción KPI (debe ser 461)', n('SELECT count(*) FROM citas c JOIN estados_cita e ON e.id_estado = c.id_estado WHERE e.es_friccion_kpi') - 461],
];
const cel = new Map(todo('SELECT id_paciente, celular FROM pacientes').map((r) => [r.id_paciente, String(r.celular ?? '').replace(/\D/g, '')]));
chequeos[7][1] = (d.prepare('SELECT numero_paciente, telefono_normalizado FROM pacientes').all() as Fila[]).filter(
  (r) => (cel.get(r.numero_paciente) ?? '') !== String(r.telefono_normalizado ?? '').replace(/\D/g, '')
).length;
const fk = d.prepare('PRAGMA foreign_key_check').all().length;
const integridad = Object.values(d.prepare('PRAGMA integrity_check').get() as Fila)[0];
console.log({ conteo, fk, integridad });
for (const [k, v] of chequeos) console.log(`${v === 0 ? '✓' : '✗'} ${k}: ${v}`);
if (fk || integridad !== 'ok' || chequeos.some(([, v]) => v !== 0)) process.exit(1);
console.log('✓ Bases combinadas sin contradicciones');
