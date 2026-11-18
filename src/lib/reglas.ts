import type { Caso, Motivo, Paciente, Resultado, Segmento } from '../types';

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

// ---------- regla 3-7-15 ----------
// Se escribe al paciente 3, 7 y 15 días después del evento.
// Cada intento sin éxito pasa al siguiente; tras el día 15 queda "agotado" (pasa a campañas).
export function pasoActual(p: Paciente): Paso | null {
  if (p.estado !== 'pendiente') return null;
  const hechos = p.contactos.length;
  return PASOS[hechos] ?? null;
}

export function fechaQueToca(p: Paciente): string | null {
  const paso = pasoActual(p);
  return paso ? sumarDias(p.fechaEvento, paso) : null;
}

export type Semaforo = 'rojo' | 'amarillo' | 'verde';

// verde = primer intento (día 3), amarillo = segundo (día 7), rojo = último (día 15) o atrasado más de 2 días
export function semaforo(p: Paciente, hoy: string): Semaforo | null {
  const paso = pasoActual(p);
  const f = fechaQueToca(p);
  if (!paso || !f) return null;
  if (paso === 15 || diasEntre(f, hoy) > 2) return 'rojo';
  return paso === 7 ? 'amarillo' : 'verde';
}

export const tocaHoy = (p: Paciente, hoy: string) => {
  const f = fechaQueToca(p);
  return f !== null && f <= hoy;
};

export const altoValor = (p: Paciente) => p.segmento !== 'local' || p.valor >= 10_000_000;

// orden de la lista del día: rojo → amarillo → verde, luego alto valor, luego valor
const PESO: Record<Semaforo, number> = { rojo: 0, amarillo: 1, verde: 2 };
export function ordenarDelDia(lista: Paciente[], hoy: string) {
  return [...lista].sort((a, b) => {
    const sa = PESO[semaforo(a, hoy) ?? 'verde'];
    const sb = PESO[semaforo(b, hoy) ?? 'verde'];
    if (sa !== sb) return sa - sb;
    if (altoValor(a) !== altoValor(b)) return altoValor(a) ? -1 : 1;
    return b.valor - a.valor;
  });
}

// aplica el resultado de un contacto y devuelve el paciente actualizado
export function registrarContacto(
  p: Paciente,
  resultado: Resultado,
  mensaje: string,
  motivo: Motivo,
  hoy: string,
  nota?: string
): Paciente {
  const paso = pasoActual(p) ?? 15;
  const contactos = [...p.contactos, { fecha: hoy, paso, resultado, mensaje, nota }];
  let estado = p.estado;
  if (resultado === 'agendo') estado = 'recuperado';
  else if (resultado === 'no_interesa') estado = 'descartado';
  else if (contactos.length >= PASOS.length) estado = 'agotado';
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
  diagnostico: 'Diagnóstico sin iniciar',
  limpieza: 'Control de limpieza',
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
export const linkWhatsApp = (tel: string, texto: string) =>
  `https://wa.me/${soloDigitos(tel)}?text=${encodeURIComponent(texto)}`;

export const ESTADO_TXT: Record<import('../types').Estado, string> = {
  pendiente: 'En seguimiento',
  recuperado: 'Recuperado',
  descartado: 'No le interesa',
  agotado: 'Sin respuesta',
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
