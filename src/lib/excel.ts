import * as XLSX from 'xlsx';
import type { Antiguedad, Caso, Cita, Grupo, Paciente, Profesional } from '../types';
import { iso, nivelRiesgo, normalizarCelular, sumarDias } from './reglas';

// ---------- estados reales del software de la clínica ----------
// Fricción para segmentar (SRS RF-02): los 6 estados que significan "la cita no se cumplió"
export const FRICCION = ['Anulado', 'Anulado por pcte. via Whatsapp', 'Cambio de fecha', 'No asiste', 'No confirmado', 'Notif. WhatsApp fallida'];
// Fricción de los KPI (SRS 52,1 %): las 4 que dejan la silla vacía
export const FRICCION_KPI = ['Cambio de fecha', 'Anulado', 'No asiste', 'Anulado por pcte. via Whatsapp'];
// Fallos que suman al score de riesgo (RN-06)
export const FALLOS = ['Cambio de fecha', 'Anulado', 'Anulado por pcte. via Whatsapp', 'No asiste', 'No confirmado'];
const INASISTENCIA = ['No asiste', 'No confirmado', 'Notif. WhatsApp fallida'];

const norm = (v: unknown) =>
  String(v ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');

type Fila = Record<string, unknown>; // claves = encabezado normalizado
const vacio = (v: unknown) => v == null || String(v).trim() === '' || String(v).trim() === '-';
const txt = (v: unknown) => (vacio(v) ? '' : String(v).trim().replace(/\s+/g, ' '));

// Lee la primera hoja y descarta las filas vacías del final
export function leerHoja(buffer: ArrayBuffer): Fila[] {
  const libro = XLSX.read(buffer, { type: 'array', cellDates: true });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval: null, raw: true });
  return filas
    .filter((f) => Object.values(f).some((v) => !vacio(v)))
    .map((f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [norm(k), v])));
}

export type TipoArchivo = 'historial' | 'detalle' | 'arancel' | 'guiones' | 'desconocido';
export function tipoDe(filas: Fila[]): TipoArchivo {
  const k = new Set(Object.keys(filas[0] ?? {}));
  if (k.has('estado actual cita')) return 'historial'; // Agenda citas y estados
  if (k.has('estado cita') && k.has('celular')) return 'detalle'; // Agenda y citas (contactos, hora, comentario)
  if (k.has('nombre accion') && k.has('precio')) return 'arancel';
  if (k.has('mensaje organizado')) return 'guiones';
  return 'desconocido';
}
export const TIPO_TXT: Record<TipoArchivo, string> = {
  historial: 'Agenda citas y estados',
  detalle: 'Agenda y citas (contactos)',
  arancel: 'Arancel de precios',
  guiones: 'Guiones de WhatsApp',
  desconocido: 'No reconocido',
};

export function leerFecha(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) return iso(v);
  if (typeof v === 'number' && v > 30000) {
    const d = XLSX.SSF.parse_date_code(v);
    return iso(new Date(d.y, d.m - 1, d.d));
  }
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(new Date(+m[1], +m[2] - 1, +m[3]));
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) return iso(new Date(+m[3], +m[2] - 1, +m[1]));
  return null;
}

function leerHora(v: unknown): string | undefined {
  if (vacio(v)) return undefined;
  if (v instanceof Date) return `${String(v.getHours()).padStart(2, '0')}:${String(v.getMinutes()).padStart(2, '0')}`;
  if (typeof v === 'number' && v < 1) {
    const min = Math.round(v * 24 * 60);
    return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
  }
  const m = String(v).match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : undefined;
}

const profesional = (nombre: unknown, apellido: unknown): Profesional =>
  /olarte|juan manuel/.test(norm(`${nombre} ${apellido}`)) ? 'Dr. Juan Manuel Olarte' : 'Dra. Sara López';

const nombrePropio = (s: string) =>
  s
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((w) => (['del', 'de', 'la', 'los'].includes(w) ? w : w[0].toUpperCase() + w.slice(1)))
    .join(' ');

// ---------- arancel (OE-05) ----------
export type Precios = Map<string, number>; // nombre de acción normalizado → precio
export function leerArancel(filas: Fila[]): Precios {
  const m: Precios = new Map();
  for (const f of filas) {
    const precio = Number(f['precio']) || 0;
    if (norm(f['habilitado']) !== 'si' || precio <= 0) continue;
    const k = norm(f['nombre accion']);
    if (!m.has(k)) m.set(k, precio);
  }
  return m;
}

// palabra clave del comentario de la cita → acción del arancel
const REGLAS_VALOR: [RegExp, string][] = [
  [/corona|\blab\b|laboratorio|cementaci/, 'Corona/Carilla Ceramica'],
  [/carilla/, 'Carilla Ceramica'],
  [/implante/, 'Implante Dental Aloplástico (Oseointegración)'],
  [/alin|refinamiento/, 'Alineadores invisibles'],
  [/ortodon|retenedor|retendor/, 'Control - Seguimiento Ortodoncia Técnica Estándar'],
  [/blanque/, 'Blanqueamiento Dental'],
  [/limpieza|profilax/, 'Profilaxis Dental'],
  [/resina|cuello/, 'Obturación en Resina de Fotocurado, Una Superficie'],
  [/desprogramador/, 'Desprogramadores'],
  [/bruxismo|placa/, 'Placa Neuro-Mio-Relajante PNMR'],
  [/urgencia/, 'Consulta de Urgencias, por Odontología Especializada'],
  [/provisional|\bprovi\b/, 'Provisional PMMA'],
  [/scaneo|escaneo/, 'Escaneo intraoral'],
  [/cordal/, 'Exodoncia Terapéutica de Tercer Molar'],
  [/fluor/, 'Aplicación tópica de Flúor en Gel'],
  [/endodon/, 'Endodoncia en Dientes Multirradiculares Permanentes'],
];

// Devuelve el valor y las acciones del arancel usadas. Sin pista en el comentario, se usa la consulta según el tipo de cita.
export function valorArancel(texto: string, tipo: 'Diagnóstico' | 'Tratamiento', precios: Precios) {
  const t = norm(texto);
  const acciones = [...new Set(REGLAS_VALOR.filter(([re]) => re.test(t)).map(([, a]) => a))];
  const porComentario = acciones.length > 0;
  if (!porComentario) acciones.push(tipo === 'Diagnóstico' ? 'Consulta de Valoración por Rehabilitación Oral' : 'Consulta de Control de Rehabilitación Oral');
  const total = acciones.reduce((s, a) => s + (precios.get(norm(a)) ?? 0), 0);
  return { total, acciones, fuente: porComentario ? ('comentario' as const) : ('tipo de cita' as const) };
}
export const estimarValor = (texto: string, tipo: 'Diagnóstico' | 'Tratamiento', precios: Precios) => valorArancel(texto, tipo, precios).total;

// ---------- cruce de archivos y segmentación (RF-01, RF-02, RF-03) ----------
export interface Carga {
  citas: Cita[];
  pacientes: Paciente[];
  fechaCorte: string;
  archivos: { nombre: string; tipo: TipoArchivo; filas: number }[];
  conContacto: number; // pacientes cruzados con el archivo de detalle
  precios: number; // acciones del arancel usadas
  avisos: string[];
}

export function procesar(entradas: { nombre: string; filas: Fila[] }[]): Carga {
  const archivos = entradas.map((e) => ({ nombre: e.nombre, tipo: tipoDe(e.filas), filas: e.filas.length }));
  const de = (t: TipoArchivo) => entradas.filter((_, i) => archivos[i].tipo === t).flatMap((e) => e.filas);
  const historial = de('historial');
  const detalle = de('detalle');
  const precios = leerArancel(de('arancel'));
  const avisos: string[] = [];
  if (!historial.length && !detalle.length) avisos.push('Falta la agenda: sube "Agenda citas y estados" o "Agenda y citas".');
  if (!precios.size) avisos.push('Sin arancel: los valores de tratamiento quedarán en $0.');

  // citas: el historial manda; el detalle aporta hora y comentario (llave: # Cita)
  const porId = new Map<number, Cita>();
  const nombres = new Map<number, string>();
  const antig = new Map<number, Set<string>>();
  historial.forEach((f, i) => {
    const id = Number(f['# cita']);
    const pac = Number(f['# paciente']);
    const fecha = leerFecha(f['fecha cita']);
    if (!id || !pac || !fecha) return;
    porId.set(id, {
      id,
      paciente: pac,
      fecha,
      estado: txt(f['estado actual cita']),
      tipo: norm(f['tratamiento o diagnostico']).startsWith('diag') ? 'Diagnóstico' : 'Tratamiento',
      profesional: profesional(f['nombre profesional tratante'], f['apellidos profesional tratante']),
      orden: i,
    });
    nombres.set(pac, `${txt(f['nombre paciente'])} ${txt(f['apellidos paciente'])}`.trim());
    if (!antig.has(pac)) antig.set(pac, new Set());
    antig.get(pac)!.add(txt(f['antiguedad paciente']));
  });

  const contacto = new Map<number, Fila>(); // última fila de detalle por paciente
  const textos = new Map<number, string[]>(); // comentarios, tipo de paciente y convenios
  detalle.forEach((f, i) => {
    const id = Number(f['# cita']);
    const pac = Number(f['# paciente']);
    const fecha = leerFecha(f['fecha cita']);
    if (!pac) return;
    const c = porId.get(id);
    const comentario = txt(f['comentario cita']) || undefined;
    if (c) {
      c.hora = leerHora(f['hora inicio cita']);
      c.comentario = comentario;
    } else if (id && fecha) {
      porId.set(id, {
        id,
        paciente: pac,
        fecha,
        hora: leerHora(f['hora inicio cita']),
        estado: txt(f['estado cita']),
        tipo: 'Tratamiento',
        profesional: profesional(f['nombre profesional cita'], f['apellidos profesional cita']),
        comentario,
        orden: 100000 + i,
      });
    }
    if (!nombres.has(pac)) nombres.set(pac, `${txt(f['nombre paciente'])} ${txt(f['apellidos paciente'])}`.trim());
    contacto.set(pac, { ...contacto.get(pac), ...Object.fromEntries(Object.entries(f).filter(([, v]) => !vacio(v))) });
    textos.set(pac, [
      ...(textos.get(pac) ?? []),
      comentario ?? '',
      txt(f['tipo paciente']),
      txt(f['convenio paciente']),
      txt(f['convenio tratamiento']),
      txt(f['observaciones']),
    ]);
  });

  const citas = [...porId.values()];
  const fechaCorte = citas.reduce((m, c) => (c.fecha > m ? c.fecha : m), '0000-00-00');
  const porPaciente = new Map<number, Cita[]>();
  for (const c of citas) porPaciente.set(c.paciente, [...(porPaciente.get(c.paciente) ?? []), c]);

  const pacientes: Paciente[] = [];
  for (const [pac, lista] of porPaciente) {
    // cronológico; en un mismo día la primera fila del Excel es la más reciente
    lista.sort((a, b) => (a.fecha === b.fecha ? b.orden - a.orden : a.fecha < b.fecha ? -1 : 1));
    const ultima = lista[lista.length - 1];
    const atendidas = lista.filter((c) => c.estado === 'Atendido');
    const diagAt = atendidas.some((c) => c.tipo === 'Diagnóstico');
    const trAt = atendidas.some((c) => c.tipo === 'Tratamiento');

    let grupo: Grupo;
    if (FRICCION.includes(ultima.estado)) grupo = 1;
    else if (ultima.estado !== 'Atendido') grupo = 4;
    else if (diagAt && !trAt) grupo = 2;
    else grupo = 3;

    const comentarioReciente = [...lista].reverse().find((c) => c.comentario)?.comentario ?? '';
    const ultimaAtendida = atendidas[atendidas.length - 1];
    const comentarioAtendida = ultimaAtendida?.comentario ?? comentarioReciente;
    const esLimpieza = /limpieza|profilax/.test(norm(comentarioAtendida));

    let caso: Caso;
    let fechaEvento = ultima.fecha;
    if (grupo === 1) caso = INASISTENCIA.includes(ultima.estado) ? 'no_asistio' : 'cancelo';
    else if (grupo === 2) caso = 'diagnostico';
    else if (grupo === 3 && esLimpieza) {
      // control de limpieza: vence a los 4 meses, o a los que diga el comentario ("Limpieza 6 meses")
      const meses = Number(norm(comentarioAtendida).match(/(\d)\s*mes/)?.[1]) || 4;
      caso = 'limpieza';
      fechaEvento = sumarDias(ultimaAtendida!.fecha, meses * 30);
    } else if (grupo === 3) {
      caso = 'pausa'; // tratamiento en pausa: cuenta desde que pasan 30 días sin volver
      fechaEvento = sumarDias((ultimaAtendida ?? ultima).fecha, 30);
    } else caso = diagAt && !trAt ? 'diagnostico' : 'pausa';

    const info = contacto.get(pac) ?? {};
    const telefono = normalizarCelular(info['celular']) || (/^\+?(57)?3\d{9}$/.test(String(info['telefono'] ?? '').replace(/\D/g, '')) ? normalizarCelular(info['telefono']) : '');
    const t = norm((textos.get(pac) ?? []).join(' | '));
    const etiquetas: string[] = [];
    if (/virtual/.test(t)) etiquetas.push('Valoración virtual');
    if (/rehabilitacion/.test(t)) etiquetas.push('Rehabilitación');
    if (/alin|ortodon/.test(t)) etiquetas.push('Alineadores');
    if (/flaires/.test(t)) etiquetas.push('Convenio FLAIRES');
    const va = valorArancel(`${comentarioReciente} ${t}`, ultima.tipo, precios);
    const valor = precios.size ? va.total : 0;
    if (etiquetas.includes('Valoración virtual') || etiquetas.includes('Rehabilitación') || valor >= 10_000_000) etiquetas.unshift('VIP');

    const an = antig.get(pac) ?? new Set();
    const antiguedad: Antiguedad = an.has('Nuevo') || !an.has('Antiguo') ? 'Nuevo' : 'Antiguo';
    const fallos = lista.filter((c) => FALLOS.includes(c.estado)).length;
    const iUltAt = lista.map((c) => c.estado).lastIndexOf('Atendido');
    const seguidos = lista.slice(iUltAt + 1).filter((c) => FALLOS.includes(c.estado)).length;
    const apoderado = [txt(info['nombre apoderado']), normalizarCelular(info['celular apoderado'])].filter(Boolean).join(' · ');

    pacientes.push({
      id: `p-${pac}`,
      idPaciente: `#${pac}`,
      nombre: nombrePropio(nombres.get(pac) || `Paciente ${pac}`),
      telefono,
      email: txt(info['e-mail']),
      apoderado,
      ciudad: '',
      segmento: telefono && !telefono.startsWith('+57') ? 'internacional' : 'local',
      antiguedad,
      etiquetas,
      grupo,
      fallosHistoricos: fallos,
      fallosSeguidos: seguidos,
      ultimaAtendida: ultimaAtendida?.fecha,
      nivelRiesgo: nivelRiesgo(seguidos, fallos),
      caso,
      fechaEvento,
      ultimaCita: { fecha: ultima.fecha, hora: ultima.hora, estado: ultima.estado, tipo: ultima.tipo },
      tratamiento: comentarioReciente || `${ultima.tipo} · Rehabilitación oral`,
      especialista: ultima.profesional,
      valor,
      valorReferencia: precios.size ? { acciones: va.acciones, fuente: va.fuente } : undefined,
      motivo: /salud|enferm/.test(t) ? 'salud' : 'sin_dato',
      estado: grupo === 4 ? 'activo' : 'pendiente',
      contactos: [],
      notas: [],
      ciclos: [],
      origen: 'excel',
      creadoEl: fechaCorte,
    });
  }

  return {
    citas,
    pacientes: pacientes.sort((a, b) => a.grupo - b.grupo || b.valor - a.valor),
    fechaCorte,
    archivos,
    conContacto: pacientes.filter((p) => contacto.has(Number(p.idPaciente.slice(1)))).length,
    precios: precios.size,
    avisos,
  };
}

export async function leerArchivos(files: { nombre: string; buffer: ArrayBuffer }[]): Promise<Carga> {
  return procesar(files.map((f) => ({ nombre: f.nombre, filas: leerHoja(f.buffer) })));
}

// Radiografía de la agenda (RF-07): todo se calcula sobre las citas cargadas
export function radiografia(citas: Cita[]) {
  const cuenta = (f: (c: Cita) => boolean) => citas.filter(f).length;
  const porEstado = new Map<string, number>();
  for (const c of citas) porEstado.set(c.estado, (porEstado.get(c.estado) ?? 0) + 1);
  const meses = new Map<string, number>();
  for (const c of citas) meses.set(c.fecha.slice(0, 7), (meses.get(c.fecha.slice(0, 7)) ?? 0) + 1);
  const friccion = cuenta((c) => FRICCION_KPI.includes(c.estado));
  const atendidas = cuenta((c) => c.estado === 'Atendido');
  return {
    total: citas.length,
    pacientes: new Set(citas.map((c) => c.paciente)).size,
    friccion,
    atendidas,
    otras: citas.length - friccion - atendidas,
    detalleFriccion: FRICCION_KPI.map((e) => ({ estado: e, n: porEstado.get(e) ?? 0 })),
    meses: [...meses.entries()].sort(([a], [b]) => (a < b ? -1 : 1)),
    sara: cuenta((c) => c.profesional === 'Dra. Sara López'),
    olarte: cuenta((c) => c.profesional === 'Dr. Juan Manuel Olarte'),
    tratamiento: cuenta((c) => c.tipo === 'Tratamiento'),
    diagnostico: cuenta((c) => c.tipo === 'Diagnóstico'),
  };
}
