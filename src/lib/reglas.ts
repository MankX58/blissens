import type { Caso, Estado, Grupo, Motivo, MotivoNoContactar, NivelRiesgo, Paciente, Profesional, Resultado, Segmento } from '../types';

export const ESPECIALISTAS: Profesional[] = ['Dra. Sara López', 'Dr. Juan Manuel Olarte', 'Dr. Juan Esteban'];
// «el Dr. …» / «la Dra. …» para meter el nombre en una frase
export const conArticulo = (d: Profesional) => (d.startsWith('Dra.') ? 'la ' : 'el ') + d;

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
  if (p.estado !== 'pendiente' || noContactar(p)) return null;
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

// Rojo = urgente (canceló o no asistió y no ha reagendado, VIP o riesgo alto) · Amarillo = seguimiento (día 7) · Verde = rescate (día 15 o limpieza preventiva)
// La clínica pidió que quien canceló o faltó siga en rojo mientras no reagende, sin importar el día.
const sinReagendar = (p: Paciente) => p.caso === 'cancelo' || p.caso === 'no_asistio';
export function semaforo(p: Paciente, hoy: string): Semaforo | null {
  const paso = pasoActual(p, hoy);
  if (!paso) return null;
  if (paso === 3 || sinReagendar(p) || esVIP(p) || riesgoAlto(p)) return 'rojo';
  if (p.caso === 'limpieza' || paso === 15) return 'verde';
  return 'amarillo';
}

// Cada paso de la regla 3-7-15 dicho como lo vive quien contacta
export const PASO_TXT: Record<Paso, string> = { 3: '1.er mensaje', 7: '2.º mensaje', 15: 'Último mensaje' };

// Qué significa cada color, igual en todas las pantallas: quiénes están ahí y qué hacer con ellos
export const SEMAFORO_INFO: Record<Semaforo, { corto: string; quienes: string; hacer: string }> = {
  rojo: {
    corto: 'Contactar hoy, primero',
    quienes: 'Cancelaron o faltaron y no han reagendado, o son VIP, o suelen faltar (riesgo alto).',
    hacer: 'Contactarlos hoy, antes que a los demás.',
  },
  amarillo: {
    corto: 'Toca el 2.º mensaje',
    quienes: 'Pasaron de 4 a 14 días y todavía no han vuelto a agendar.',
    hacer: 'Enviar el 2.º mensaje con otra propuesta de día u hora.',
  },
  verde: {
    corto: 'Último intento',
    quienes: 'Pasaron 15 días o más sin agendar, o les toca su control de limpieza.',
    hacer: 'Último intento. Si no responde, pasa a las campañas de WhatsApp.',
  },
};

// Por qué ESTE paciente tiene su color (la primera razón que aplica, en el mismo orden que la regla)
export function porQueSemaforo(p: Paciente, hoy: string): string {
  const color = semaforo(p, hoy);
  const paso = pasoActual(p, hoy);
  if (!color || !paso) return '';
  const dias = diasEntre(p.fechaEvento, hoy);
  const hace = dias <= 0 ? 'hoy' : `hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
  if (color === 'rojo') {
    if (paso === 3) return `Pasó ${hace}: es el mejor momento para que vuelva`;
    if (sinReagendar(p)) return `${p.caso === 'cancelo' ? 'Canceló' : 'No asistió'} ${hace} y no ha reagendado`;
    if (esVIP(p)) return `Es VIP (${(p.motivoVip ?? 'tratamiento de alto valor').toLowerCase()}): no se puede perder`;
    return `Suele faltar: ${p.fallosSeguidos} citas seguidas sin asistir`;
  }
  if (color === 'verde') return p.caso === 'limpieza' ? 'Le toca su control de limpieza' : `Pasó ${hace} sin agendar: último intento`;
  return `Pasó ${hace} sin agendar: toca el 2.º mensaje`;
}

export const tocaHoy = (p: Paciente, hoy: string) => {
  const f = fechaQueToca(p, hoy);
  return f !== null && f <= hoy;
};

// orden de todas las listas (igual que el backend): urgencia → VIP → riesgo alto → valor
const PESO: Record<Semaforo, number> = { rojo: 0, amarillo: 1, verde: 2 };
export function ordenarDelDia(lista: Paciente[], hoy: string) {
  return [...lista].sort((a, b) => {
    const sa = PESO[semaforo(a, hoy) ?? 'verde'];
    const sb = PESO[semaforo(b, hoy) ?? 'verde'];
    if (sa !== sb) return sa - sb;
    if (esVIP(a) !== esVIP(b)) return esVIP(a) ? -1 : 1;
    if (riesgoAlto(a) !== riesgoAlto(b)) return riesgoAlto(a) ? -1 : 1;
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
  sin_whatsapp: 'Sin WhatsApp',
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

// ---------- lo que contó la clínica ----------
// «Anulado» lo anula la clínica (no el paciente): no es culpa suya y se le ofrece disculpa
export const anuladoPorClinica = (p: Paciente) => p.ultimaCita?.estado === 'Anulado';

// Marcas que viajan como notas (hasta que el backend tenga campos propios): manda la más reciente
const todasLasNotas = (p: Paciente) =>
  [...p.notas.map((n) => n.texto), ...p.contactos.map((c) => c.nota ?? ''), ...p.ciclos.flatMap((c) => c.contactos.map((x) => x.nota ?? ''))];
export const ADELANTAR = 'Quiere adelantar su cita';
export const NO_ADELANTAR = 'Ya no quiere adelantar su cita';
// marca sí/no guardada como nota: manda la última que aparezca (null = nunca se marcó)
function marca(p: Paciente, si: string, no: string): boolean | null {
  const ultima = todasLasNotas(p).filter((t) => t.includes(si) || t.includes(no)).at(-1);
  return ultima === undefined ? null : !ultima.includes(no);
}
export const AUTORIZA = 'Autorizó escribirle por WhatsApp';
export const NO_AUTORIZA = 'No autorizó escribirle por WhatsApp';
export const consentimiento = (p: Paciente): boolean | null => (p.consentimientoWhatsapp !== undefined ? p.consentimientoWhatsapp : marca(p, AUTORIZA, NO_AUTORIZA));
export const EN_CHAT = 'Ya tiene chat de WhatsApp con la clínica';
export const SIN_CHAT = 'Ya no tiene chat de WhatsApp con la clínica';
export const enChat = (p: Paciente) => p.enChatWhatsapp ?? marca(p, EN_CHAT, SIN_CHAT) ?? false;

export function quiereAdelantar(p: Paciente): boolean {
  if (p.quiereAdelantarCita !== undefined) return p.quiereAdelantarCita;
  const ultima = todasLasNotas(p).filter((t) => t.includes(ADELANTAR) || t.includes(NO_ADELANTAR)).at(-1);
  return !!ultima && !ultima.includes(NO_ADELANTAR);
}

// No volver a contactar: la clínica lo pidió para estos casos
export const NO_CONTACTAR_TXT: Record<MotivoNoContactar, string> = {
  no_le_interesa: 'No le interesa',
  tratamiento_terminado: 'Tratamiento terminado',
  queja_activa: 'Queja activa',
  deuda_en_cobro: 'Deuda en cobro',
  fallecido: 'Fallecido',
};
export const NO_CONTACTAR = Object.keys(NO_CONTACTAR_TXT) as MotivoNoContactar[];
export const prefijoNoContactar = 'No contactar: ';
// motivo por el que no se le vuelve a escribir (campo del backend o, mientras tanto, la nota que deja el panel)
export function motivoNoContactar(p: Paciente): string | undefined {
  if (p.noContactar !== undefined) return p.noContactar ? NO_CONTACTAR_TXT[p.motivoNoContactar ?? 'no_le_interesa'] : undefined;
  if (p.estado !== 'descartado') return undefined;
  const t = todasLasNotas(p).filter((x) => x.startsWith(prefijoNoContactar)).at(-1);
  return t ? t.slice(prefijoNoContactar.length).split('.')[0] : 'No le interesa';
}
export const noContactar = (p: Paciente) => !!motivoNoContactar(p);

// Perdido: más de 60 días sin volver (regla de la clínica)
export const perdido = (p: Paciente, hoy: string) =>
  p.perdido60 ?? ((p.estado === 'pendiente' || p.estado === 'agotado') && diasEntre(p.fechaEvento, hoy) > 60);
export const tresCambiosFecha = (p: Paciente) => p.tresCambiosFecha ?? (p.cambiosFecha ?? 0) >= 3;
export const esInternacional = (p: Paciente) => p.segmento === 'internacional' || p.idioma === 'en';

// Horario de recepción (lun-vie 8-12 y 13-17): fuera de él no hay quién responda el WhatsApp
export const enHorarioClinica = (d = new Date()) => {
  const dia = d.getDay();
  const h = d.getHours() + d.getMinutes() / 60;
  return dia >= 1 && dia <= 5 && h >= 8 && h < 17;
};

// ---------- ocupación de la agenda (meta de la clínica: 85 %) ----------
export const META_OCUPACION = 85;
export const DIAS_TXT = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const diaSemana = (f: string) => {
  const [y, m, d] = f.split('-').map(Number);
  return new Date(y, m - 1, d).getDay(); // 0 = domingo
};
// Estimada: cada día con agenda de un especialista cuenta 8 h (8-12 y 13-17); lo libre son los cupos sin ocupar.
// ponytail: capacidad fija de 8 h; con los horarios reales del equipo (o el endpoint /indicadores del backend) sería exacta.
export function ocupacion(citas: { fecha: string; profesional: string }[], huecos: { fecha: string; especialista: string; minutos: number; ocupadoPor?: string; verificacion?: string }[], desde: string, dias = 14) {
  const hasta = sumarDias(desde, dias - 1);
  const enRango = (f: string) => f >= desde && f <= hasta && diaSemana(f) >= 1 && diaSemana(f) <= 5;
  const agendas = new Set([...citas.filter((c) => enRango(c.fecha)).map((c) => `${c.fecha}|${c.profesional}`), ...huecos.filter((h) => enRango(h.fecha)).map((h) => `${h.fecha}|${h.especialista}`)]);
  const cap = Array(5).fill(0);
  const libre = Array(5).fill(0);
  agendas.forEach((k) => (cap[diaSemana(k.split('|')[0]) - 1] += 480));
  huecos.filter((h) => enRango(h.fecha) && !h.ocupadoPor && h.verificacion !== 'ocupado').forEach((h) => (libre[diaSemana(h.fecha) - 1] += h.minutos));
  const pct = (c: number, l: number) => (c ? Math.max(0, Math.round(((c - l) / c) * 100)) : 0);
  const total = cap.reduce((a, b) => a + b, 0);
  return { pct: pct(total, libre.reduce((a, b) => a + b, 0)), hay: total > 0, porDia: DIAS_TXT.map((k, i) => ({ k, v: pct(cap[i], libre[i]), hay: cap[i] > 0 })) };
}

// acompañamiento de abonos: días 3 y 7 después de la valoración (campo del backend o, mientras tanto, por fecha)
export const tocaAbono = (p: Paciente, hoy: string) =>
  p.tocaAbonoHoy ?? (p.estado === 'pendiente' && p.grupo === 2 && [3, 7].includes(diasEntre(p.fechaEvento, hoy)));
