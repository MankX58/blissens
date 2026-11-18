import * as XLSX from 'xlsx';
import type { Caso, Hueco, Motivo, Paciente, Segmento } from '../types';
import { hoyISO, iso, sumarDias } from './reglas';

const norm = (v: unknown) =>
  String(v ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

function campo(fila: Record<string, unknown>, claves: string[]): unknown {
  const entradas = Object.entries(fila);
  for (const c of claves) {
    const e = entradas.find(([k]) => norm(k).includes(c));
    if (e && e[1] !== '' && e[1] != null) return e[1];
  }
  return '';
}
const texto = (fila: Record<string, unknown>, claves: string[]) => String(campo(fila, claves)).trim();

export function detectarCaso(estado: string, tratamiento: string): Caso | null {
  const e = norm(estado);
  const t = norm(tratamiento);
  if (e.includes('no asist') || e.includes('inasist') || e.includes('ausent') || e.includes('no vino')) return 'no_asistio';
  if (e.includes('cancel')) return 'cancelo';
  if (e.includes('diagnost') || e.includes('sin iniciar') || e.includes('presupuesto') || e.includes('valoracion')) return 'diagnostico';
  if (e.includes('limpieza') || e.includes('control') || e.includes('higiene') || t.includes('limpieza') || t.includes('profilaxis')) return 'limpieza';
  return null; // asistió, confirmada, etc. → no hay que contactar
}

function detectarSegmento(seg: string, ciudad: string): Segmento {
  const s = `${norm(seg)} ${norm(ciudad)}`;
  if (/internac|extranj|exterior|usa|miami|new york|canada|espana|panama|mexico/.test(s)) return 'internacional';
  if (/deport|atleta|seleccion|ciclis|futbol|tenis|nadador/.test(s)) return 'deportista';
  return 'local';
}

function detectarMotivo(raw: string): Motivo {
  const n = norm(raw);
  if (!n) return 'sin_dato';
  if (/costo|precio|presup|plata|dinero|pago/.test(n)) return 'costos';
  if (/agenda|horario|tiempo|trabajo/.test(n)) return 'agenda';
  if (/viaje|traslado|vuelo/.test(n)) return 'viaje';
  if (/miedo|ansied|dolor|nervio/.test(n)) return 'miedo';
  if (/enferm|salud|incapac/.test(n)) return 'salud';
  if (/no respond|sin resp/.test(n)) return 'sin_dato';
  return 'otro';
}

// Acepta fecha de Excel (Date), "2026-11-03", "03/11/2026" o "3-11-2026"
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

export interface ResultadoLectura {
  filas: number;
  pacientes: Paciente[];
  huecos: Hueco[];
  ignoradas: number; // citas cumplidas o confirmadas
  sinTelefono: number;
}

export async function leerAgenda(file: File): Promise<ResultadoLectura> {
  const libro = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval: '' });
  const hoy = hoyISO();
  const pacientes: Paciente[] = [];
  const huecos: Hueco[] = [];
  let ignoradas = 0;
  let sinTelefono = 0;

  filas.forEach((fila, i) => {
    const nombre = texto(fila, ['paciente', 'nombre']);
    if (!nombre) return;
    const estado = texto(fila, ['estado', 'situacion']);
    const tratamiento = texto(fila, ['tratamiento', 'procedimiento', 'motivo de consulta']) || 'Valoración';
    const caso = detectarCaso(estado, tratamiento);
    const especialista = texto(fila, ['especialista', 'doctor', 'odontologo']) || 'Dra. Sara López';
    const fecha = leerFecha(campo(fila, ['fecha']));
    const hora = texto(fila, ['hora']);

    // una cancelación con fecha futura deja un hueco en la agenda
    if ((caso === 'cancelo' || caso === 'no_asistio') && fecha && fecha >= hoy && hora) {
      huecos.push({ id: `xh-${Date.now()}-${i}`, fecha, hora: hora.slice(0, 5), minutos: 60, especialista, ofertas: [] });
    }
    if (!caso) {
      ignoradas++;
      return;
    }
    const telefono = texto(fila, ['celular', 'telefono', 'whatsapp', 'movil']);
    if (!telefono) sinTelefono++;
    const ciudad = texto(fila, ['ciudad', 'pais', 'origen']) || 'Medellín';
    const diasRaw = Number(texto(fila, ['dias']));
    // una cita futura cancelada cuenta desde hoy (cuando se canceló), no desde la fecha de la cita
    const fechaEvento = fecha ? (fecha > hoy ? hoy : fecha) : diasRaw > 0 ? sumarDias(hoy, -diasRaw) : hoy;
    const valor = Number(texto(fila, ['valor', 'presupuesto', 'monto']).replace(/[^\d]/g, '')) || 0;

    pacientes.push({
      id: `xl-${Date.now()}-${i}`,
      nombre,
      telefono,
      ciudad,
      segmento: detectarSegmento(texto(fila, ['segmento', 'perfil', 'tipo']), ciudad),
      caso,
      fechaEvento,
      tratamiento,
      especialista,
      valor,
      motivo: detectarMotivo(texto(fila, ['motivo', 'razon', 'observ'])),
      estado: 'pendiente',
      contactos: [],
      notas: [],
      ciclos: [],
      origen: 'excel',
      creadoEl: hoy,
    });
  });

  return { filas: filas.length, pacientes, huecos, ignoradas, sinTelefono };
}

// Plantilla con fechas relativas a hoy, para probar sin el archivo real
export function descargarPlantilla() {
  const hoy = hoyISO();
  const filas = [
    ['Isabela Restrepo Gómez', '+57 314 682 1904', 'Diagnóstico sin iniciar', sumarDias(hoy, -15), '', 'Diseño de sonrisa con carillas', 'Dra. Sara López · Rehabilitación oral', 'Local', 'Medellín', 12800000, 'Costos'],
    ['Marcus Vance', '+1 305 842 9910', 'Canceló', sumarDias(hoy, -7), '09:00', 'Implantes de carga inmediata', 'Dr. Juan Manuel Olarte · Implantes', 'Internacional', 'Miami, USA', 24500000, 'Vuelo'],
    ['Juliana Vélez Montoya', '+57 301 554 3321', 'Control limpieza pendiente', sumarDias(hoy, -3), '', 'Limpieza y mantenimiento', 'Dr. Felipe Giraldo · Periodoncia', 'Deportista', 'Medellín', 480000, ''],
    ['Tomás Saldarriaga', '+57 311 720 4498', 'No asistió', sumarDias(hoy, -3), '15:00', 'Alineadores etapa 3', 'Dra. Camila Restrepo · Ortodoncia', 'Local', 'Envigado', 7900000, 'Horario'],
    ['Laura Gómez', '+57 300 112 3344', 'Canceló', sumarDias(hoy, 4), '10:00', 'Corona en zirconio', 'Dra. Sara López · Rehabilitación oral', 'Local', 'Sabaneta', 2100000, 'Trabajo'],
    ['Andrés Mejía', '+57 315 998 1200', 'Asistió', sumarDias(hoy, -1), '11:00', 'Valoración', 'Dr. Juan Manuel Olarte · Implantes', 'Local', 'Medellín', 0, ''],
  ];
  const hoja = XLSX.utils.aoa_to_sheet([
    ['Paciente', 'Celular', 'Estado', 'Fecha', 'Hora', 'Tratamiento', 'Especialista', 'Segmento', 'Ciudad', 'Valor', 'Motivo'],
    ...filas,
  ]);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Agenda');
  XLSX.writeFile(libro, 'agenda-blissens-ejemplo.xlsx');
}
