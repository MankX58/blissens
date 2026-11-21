import type { Caso, Estado, Grupo, Motivo, NivelRiesgo, Paciente, Profesional, Resultado, Segmento } from '../types';

export const ESPECIALISTAS: Profesional[] = ['Dra. Sara López', 'Dr. Juan Manuel Olarte'];

export const PASOS = [3, 7, 15] as const;
export type Paso = (typeof PASOS)[number];

// ---------- fechas (siempre YYYY-MM-DD, hora local) ----------
export const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const hoyISO = () => iso(new Date());
export const sumarDias = (fecha: string, n: number) => {
  const [y, m, d] = fecha.split('-').map(Number);
  return iso(new Date(y, m - 1, d + n));
};
export const diasEntre = (a: string, b: string) => {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
};

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const fechaCorta = (f: string) => {
  const [, m, d] = f.split('-').map(Number);
  return `${d} ${MESES[m - 1]}`;
};

// ---------- regla 3-7-15 (RN-05 del SRS) ----------
// La etapa la marcan los días desde el evento: 0-3 urgente, 4-14 seguimiento (día 7), 15+ rescate (día 15).
// Cada etapa admite un intento; si el rescate del día 15 no funciona, queda "agotado" y pasa a campañas.
export const etapaPorDias = (dias: number): Paso => (dias <= 3 ? 3 : dias <= 14 ? 7 : 15);

export function pasoActual(p: Paciente, hoy: string): Paso | null {
  if (p.estado !== 'pendiente') return null;
  const ultimo = Math.max(0, ...p.contactos.map((c) => c.paso));
  const etapa = etapaPorDias(diasEntre(p.fechaEvento, hoy));
  return PASOS.find((s) => s > ultimo && s >= etapa) ?? PASOS.find((s) => s > ultimo) ?? null;
}

// el día 3 se atiende apenas ocurre el evento; los demás, al cumplirse el día
export function fechaQueToca(p: Paciente, hoy: string): string | null {
  const paso = pasoActual(p, hoy);
  if (!paso) return null;
  return sumarDias(p.fechaEvento, paso === 3 ? 0 : paso);
}

// días de retraso respecto a la ventana de la etapa (día 3: hasta el día 3; día 7: hasta el día 14; el rescate no vence)
export function diasDeRetraso(p: Paciente, hoy: string): number {
  const paso = pasoActual(p, hoy);
  if (!paso || paso === 15) return 0;
  return Math.max(0, diasEntre(sumarDias(p.fechaEvento, paso === 3 ? 3 : 14), hoy));
}

export type Semaforo = 'rojo' | 'amarillo' | 'verde';

// Riesgo (RN-06): cuentan las citas sin cumplir DESDE LA ÚLTIMA VEZ QUE ASISTIÓ.
// Si falló y luego volvió, esos fallos ya no suben su riesgo (quedan solo como historial).
export const riesgoAlto = (p: Paciente) => p.fallosSeguidos >= 3;
export const esVIP = (p: Paciente) => p.etiquetas.includes('VIP');
// Alto: 3+ seguidas sin asistir · Medio: 1-2 seguidas, o reprograma mucho (3+ en total) aunque sigue viniendo · Bajo: el resto
export const nivelRiesgo = (seguidos: number, total: number): NivelRiesgo => (seguidos >= 3 ? 'Alto' : seguidos >= 1 || total >= 3 ? 'Medio' : 'Bajo');

// Rojo = urgente (día 3, VIP o riesgo alto) · Amarillo = seguimiento (día 7) · Verde = rescate (día 15 o limpieza preventiva)
export function semaforo(p: Paciente, hoy: string): Semaforo | null {
  const paso = pasoActual(p, hoy);
  if (!paso) return null;
  if (paso === 3 || esVIP(p) || riesgoAlto(p)) return 'rojo';
  if (p.caso === 'limpieza' || paso === 15) return 'verde';
  return 'amarillo';
}

export const tocaHoy = (p: Paciente, hoy: string) => {
  const f = fechaQueToca(p, hoy);
  return f !== null && f <= hoy;
};

export const altoValor = (p: Paciente) => esVIP(p) || p.segmento !== 'local' || p.valor >= 10_000_000;

// orden de la bandeja: rojo → amarillo → verde, luego riesgo, alto valor y valor
const PESO: Record<Semaforo, number> = { rojo: 0, amarillo: 1, verde: 2 };
export function ordenarDelDia(lista: Paciente[], hoy: string) {
  return [...lista].sort((a, b) => {
    const sa = PESO[semaforo(a, hoy) ?? 'verde'];
    const sb = PESO[semaforo(b, hoy) ?? 'verde'];
    if (sa !== sb) return sa - sb;
    if (riesgoAlto(a) !== riesgoAlto(b)) return riesgoAlto(a) ? -1 : 1;
    if (altoValor(a) !== altoValor(b)) return altoValor(a) ? -1 : 1;
    return b.valor - a.valor;
  });
}

export function registrarContacto(p: Paciente, resultado: Resultado, mensaje: string, motivo: Motivo, hoy: string, nota?: string): Paciente {
  const paso = pasoActual(p, hoy) ?? 15;
  const contactos = [...p.contactos, { fecha: hoy, paso, resultado, mensaje, nota }];
  let estado = p.estado;
  if (resultado === 'agendo') estado = 'recuperado';
  else if (resultado === 'no_interesa') estado = 'descartado';
  else if (paso === 15) estado = 'agotado';
  return {
    ...p,
    contactos,
    motivo: motivo === 'sin_dato' ? p.motivo : motivo,
    estado,
    recuperadoEl: estado === 'recuperado' ? hoy : p.recuperadoEl,
  };
}

// ---------- textos ----------
export const CASO_TXT: Record<Caso, string> = {
  cancelo: 'Canceló la cita',
  no_asistio: 'No asistió',
  diagnostico: 'Diagnóstico sin tratamiento',
  pausa: 'Tratamiento en pausa',
  limpieza: 'Control de limpieza',
};
export const GRUPO_TXT: Record<Grupo, string> = {
  1: 'Sin reagendar',
  2: 'Diagnóstico sin tratamiento',
  3: 'Tratamiento en pausa / control',
  4: 'Activo con cita confirmada',
};
export const SEGMENTO_TXT: Record<Segmento, string> = {
  local: 'Local',
  internacional: 'Internacional',
  deportista: 'Deportista',
};
export const MOTIVO_TXT: Record<Motivo, string> = {
  costos: 'Costos o presupuesto',
  agenda: 'Horario / agenda',
  viaje: 'Viaje o traslado',
  miedo: 'Miedo o ansiedad',
  salud: 'Tema de salud',
  otro: 'Otro',
  sin_dato: 'Sin dato',
};
export const RESULTADO_TXT: Record<Resultado, string> = {
  agendo: 'Agendó cita',
  sin_respuesta: 'No respondió',
  lo_pensara: 'Lo va a pensar',
  no_interesa: 'No le interesa',
};

export const pesos = (n: number) =>
  '$' + Math.round(n).toLocaleString('es-CO', { maximumFractionDigits: 0 });
export const pesosCorto = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M` : pesos(n);

export const soloDigitos = (tel: string) => {
  const d = tel.replace(/\D/g, '');
  return d.length === 10 && d.startsWith('3') ? '57' + d : d; // celular colombiano sin indicativo
};

// Normaliza a +57XXXXXXXXXX. Acepta números de Excel (573108926704 o 3108926704), texto con espacios
// y descarta lo que no es un celular válido (fijos de 7 dígitos, notación científica que perdió dígitos).
export function normalizarCelular(v: unknown): string {
  if (v == null) return '';
  let s = typeof v === 'number' ? String(Math.round(v)) : String(v).trim();
  if (/e\+?\d+$/i.test(s)) {
    const n = Number(s.replace(',', '.'));
    if (!Number.isFinite(n)) return '';
    s = String(Math.round(n));
    if (/0{4,}$/.test(s)) return ''; // 5.7318E11: los últimos dígitos se perdieron
  }
  const d = s.replace(/\D/g, '');
  if (d.length === 10 && d.startsWith('3')) return '+57' + d;
  if (d.length === 12 && d.startsWith('573')) return '+' + d;
  if (d.length >= 11 && !d.startsWith('57')) return '+' + d; // número extranjero con indicativo
  return '';
}
export const linkWhatsApp = (tel: string, texto: string) =>
  `https://wa.me/${soloDigitos(tel)}?text=${encodeURIComponent(texto)}`;

export const ESTADO_TXT: Record<Estado, string> = {
  pendiente: 'En seguimiento',
  recuperado: 'Recuperado',
  descartado: 'No le interesa',
  agotado: 'Sin respuesta',
  activo: 'Activo con cita',
};

// Cierra el proceso actual (queda en el historial) y abre uno nuevo desde cero
export function nuevoCiclo(p: Paciente, caso: Caso, fechaEvento: string): Paciente {
  return {
    ...p,
    ciclos: [...p.ciclos, { caso: p.caso, fechaEvento: p.fechaEvento, contactos: p.contactos, cierre: p.estado, motivo: p.motivo }],
    caso,
    fechaEvento,
    contactos: [],
    estado: 'pendiente',
    recuperadoEl: undefined,
  };
}

export const ultimoContacto = (p: Paciente) => p.contactos.at(-1) ?? p.ciclos.at(-1)?.contactos.at(-1);
