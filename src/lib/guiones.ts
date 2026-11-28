import type { Hueco, Paciente, Profesional } from '../types';
import { GUIONES, type GuionOficial } from '../data/guiones';
import { anuladoPorClinica, esInternacional, pasoActual, riesgoAlto } from './reglas';

// "Ofrecer cita con otro profesional": reasignación por viaje del Dr. Olarte (fila 10 del Excel)
export const N_REASIGNACION = 9;
export const N_UBICACION = 24;

export interface Contexto {
  asesora: string;
  nuevaFecha?: string; // YYYY-MM-DD
  nuevaHora?: string; // HH:MM
  tono?: 'usted' | 'tu'; // la clínica trata de «usted»; si el paciente tutea, se pasa a «tú»
}

// Plantillas propias (no están en el Excel oficial): reagendar sin culpar al paciente, inglés para internacionales y autorización de datos
export const N_REAGENDAR = 101;
export const N_AUTORIZACION = 104;
export const TEXTO_AUTORIZACION =
  'Hola, [NOMBRE]. En BLISSENS ODONTOLOGÍA cuidamos sus datos personales según la Ley 1581 de 2012. ¿Nos autoriza a escribirle por WhatsApp para recordarle sus citas, controles y novedades de su tratamiento? Puede responder SÍ o NO, y retirar su autorización cuando quiera escribiéndonos a este mismo chat.';
export const PROPIOS: GuionOficial[] = [
  {
    n: N_REAGENDAR,
    categoria: 'Blissens · seguimiento',
    situacion: 'Reagendar tras cancelación o inasistencia',
    texto: 'Hola, [NOMBRE]. Te saluda [ASESOR/A], de BLISSENS ODONTOLOGÍA, de parte del Dr. Juan Manuel Olarte. Vimos que no fue posible tu cita del [FECHA] y queremos ayudarte a reprogramarla para que no pierdas el avance de tu tratamiento. ¿Te queda mejor en la mañana o en la tarde?',
    usted: 'Hola, [NOMBRE]. Le saluda [ASESOR/A], de BLISSENS ODONTOLOGÍA, de parte del Dr. Juan Manuel Olarte. Vimos que no fue posible su cita del [FECHA] y queremos ayudarle a reprogramarla para que no pierda el avance de su tratamiento. ¿Le queda mejor en la mañana o en la tarde?',
    nota: '',
  },
  {
    n: N_AUTORIZACION,
    categoria: 'Blissens · datos personales',
    situacion: 'Autorización para escribir por WhatsApp',
    texto: TEXTO_AUTORIZACION,
    usted: TEXTO_AUTORIZACION,
    nota: '',
  },
  {
    n: 105,
    categoria: 'Blissens · acompañamiento de abonos',
    situacion: 'Abono: día 3 después de la valoración',
    texto: 'Hola, [NOMBRE]. ¿Cómo has estado después de tu valoración con el Dr. Juan Manuel Olarte? Queremos acompañarte para empezar tu plan de tratamiento. Si quieres, te contamos las formas de pago y separamos tu primera cita. ¿Te queda mejor en la mañana o en la tarde?',
    usted: 'Hola, [NOMBRE]. ¿Cómo ha estado después de su valoración con el Dr. Juan Manuel Olarte? Queremos acompañarle para empezar su plan de tratamiento. Si desea, le contamos las formas de pago y separamos su primera cita. ¿Le queda mejor en la mañana o en la tarde?',
    nota: '',
  },
  {
    n: 106,
    categoria: 'Blissens · acompañamiento de abonos',
    situacion: 'Abono: día 7 (recordatorio amable)',
    texto: 'Hola, [NOMBRE]. Te escribimos de parte del Dr. Juan Manuel Olarte para saber si pudiste revisar tu plan de tratamiento. Podemos organizarlo por etapas para que te quede más cómodo. Cuéntanos y con gusto te ayudamos a volver a empezar.',
    usted: 'Hola, [NOMBRE]. Le escribimos de parte del Dr. Juan Manuel Olarte para saber si pudo revisar su plan de tratamiento. Podemos organizarlo por etapas para que le quede más cómodo. Cuéntenos y con gusto le ayudamos a volver a empezar.',
    nota: '',
  },
  ...(
    [
      [201, 'Follow-up after a missed appointment (English)', "Hello, [NOMBRE]. This is [ASESOR/A] from BLISSENS ODONTOLOGÍA, on behalf of [DOCTOR]. We noticed your appointment on [FECHA_EN] could not take place and we would love to help you reschedule it, so you don't lose your treatment progress. Would morning or afternoon work better for you?"],
      [202, 'Appointment confirmation (English)', 'Hello, [NOMBRE]. This is a friendly reminder of your dental appointment with [DOCTOR] at BLISSENS ODONTOLOGÍA (El Tesoro, Medical Tower 2, office 1157). Could you please confirm your attendance?'],
      [203, 'Treatment plan follow-up (English)', 'Hello, [NOMBRE]. We are writing on behalf of [DOCTOR]. Your treatment plan is ready to continue whenever you are. We know your time in Medellín is limited, so we can arrange your appointments to fit your stay. When would be a good time for you?'],
    ] as const
  ).map(([n, situacion, texto]) => ({ n, categoria: 'Blissens · English', situacion, texto, usted: texto, nota: '' })),
];
export const TODOS_GUIONES = [...GUIONES, ...PROPIOS];

export interface Guion {
  id: string; // "13" o "6+24"
  titulo: string;
  categoria: string;
  texto: string;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const fechaLarga = (f?: string) => {
  if (!f) return '';
  const [, m, d] = f.split('-').map(Number);
  return `${d} de ${MESES[m - 1]}`;
};
export const horaLarga = (h?: string) => {
  if (!h) return '';
  const [hh, mm] = h.split(':').map(Number);
  return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'a. m.' : 'p. m.'}`;
};

// Si el guion nombra a un solo profesional, se ajusta al del paciente
const formas = (d: Profesional) => (d.startsWith('Dra.') ? [`de la ${d}`, `la ${d}`] : [`del ${d}`, `el ${d}`]);
function ajustarDoctor(texto: string, doctor: Profesional) {
  const tieneSara = texto.includes('Dra. Sara López');
  const tieneOlarte = texto.includes('Dr. Juan Manuel Olarte');
  if (tieneSara === tieneOlarte) return texto; // nombra a los dos (o a ninguno): se deja igual
  const de = formas(tieneSara ? 'Dra. Sara López' : 'Dr. Juan Manuel Olarte');
  const a = formas(doctor);
  return texto.replaceAll(de[0], a[0]).replaceAll(de[1], a[1]);
}

// Reemplaza las variables entre corchetes del Excel de guiones
export function rellenar(texto: string, p: Paciente, ctx: Contexto, opciones: { doctor?: boolean } = {}): string {
  const primerNombre = p.nombre.split(' ')[0];
  let t = texto
    .replaceAll('[NOMBRE DEL PACIENTE]', p.nombre)
    .replaceAll('[NOMBRE DEL ASESOR/A]', ctx.asesora)
    .replaceAll('[ASESOR/A]', ctx.asesora)
    .replaceAll('[NOMBRE]', primerNombre)
    .replaceAll('[DOCTOR]', p.especialista)
    .replaceAll('[FECHA_EN]', p.ultimaCita ? new Date(`${p.ultimaCita.fecha}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : 'your last appointment date')
    .replaceAll('[FECHA]', fechaLarga(p.ultimaCita?.fecha) || '[FECHA]')
    .replaceAll('[HORA]', horaLarga(p.ultimaCita?.hora) || '[HORA]')
    .replaceAll('[VALOR]', p.valor ? Math.round(p.valor).toLocaleString('es-CO') : '[VALOR]');
  if (ctx.nuevaFecha) t = t.replaceAll('[NUEVA FECHA]', fechaLarga(ctx.nuevaFecha));
  if (ctx.nuevaHora) t = t.replaceAll('[NUEVA HORA]', horaLarga(ctx.nuevaHora));
  return opciones.doctor === false ? t : ajustarDoctor(t, p.especialista);
}

export const oficial = (n: number) => TODOS_GUIONES.find((g) => g.n === n)!;

const comoGuion = (n: number, p: Paciente, ctx: Contexto, doctor = true): Guion => {
  const g = oficial(n);
  const base = ctx.tono === 'tu' ? g.texto : g.usted;
  return { id: String(n), titulo: n > 100 ? g.situacion : `#${n} · ${g.situacion}`, categoria: g.categoria, texto: rellenar(base, p, ctx, { doctor }) };
};

// Matriz 5.1 del SRS: qué guion va según el caso, la etapa 3-7-15 y las etiquetas
export function recomendados(p: Paciente, hoy: string): number[] {
  const paso = pasoActual(p, hoy) ?? 3;
  const r: number[] = [];
  if (p.etiquetas.includes('Convenio FLAIRES')) r.push(18);
  const ingles = esInternacional(p);
  if (p.caso === 'cancelo' || p.caso === 'no_asistio') {
    if (ingles) r.push(201);
    if (p.motivo === 'salud') r.push(8);
    // «Anulado» lo anula la clínica: se pide disculpas y se propone fecha (guion 7); si fue el paciente, se reagenda sin culparlo
    if (anuladoPorClinica(p)) r.push(7);
    r.push(paso === 3 ? N_REAGENDAR : paso === 7 ? 11 : 12);
    if (p.especialista === 'Dr. Juan Manuel Olarte') r.push(N_REASIGNACION);
  }
  if (p.pasoAbono === 3 || p.pasoAbono === 7) r.push(p.pasoAbono === 3 ? 105 : 106);
  if (p.caso === 'diagnostico') r.push(...(ingles ? [203] : []), ...(p.pasoAbono ? [] : [105]), 13, 15, 4);
  if (p.caso === 'pausa') r.push(...(ingles ? [203] : []), 13, 15);
  if (p.caso === 'limpieza') r.push(10, 12, 17);
  if (p.estado === 'activo') r.unshift(...(ingles ? [202] : []), 6);
  return [...new Set(r.length ? r : [11])];
}

// Lista para el modal: primero los recomendados, después la confirmación preventiva y luego el resto
export function guionesPara(p: Paciente, hoy: string, ctx: Contexto): { sugeridos: Guion[]; todos: Guion[] } {
  const sugeridos = recomendados(p, hoy).map((n) => comoGuion(n, p, ctx, n !== N_REASIGNACION));
  if (riesgoAlto(p) || p.estado === 'activo') {
    sugeridos.push({
      id: '6+24',
      titulo: 'Doble confirmación · riesgo alto',
      categoria: '02 + 09',
      texto: `${comoGuion(6, p, ctx).texto}\n\n${comoGuion(N_UBICACION, p, ctx).texto}`,
    });
  }
  const todos = TODOS_GUIONES.map((g) => comoGuion(g.n, p, ctx, g.n !== N_REASIGNACION));
  return { sugeridos, todos };
}

export const guionReasignacion = (p: Paciente, ctx: Contexto) => comoGuion(N_REASIGNACION, p, ctx, false).texto;

// Mensaje para ofrecer un cupo de la agenda libre
export function guionHueco(p: Paciente, h: Hueco, ctx: Contexto): string {
  const cupo = `Tenemos un cupo el ${fechaLarga(h.fecha)} a las ${horaLarga(h.hora)} en BLISSENS ODONTOLOGÍA, El Tesoro, torre médica 2, consultorio 1157. ¿${ctx.tono === 'tu' ? 'Te' : 'Se'} lo apartamos?`;
  if (p.especialista === 'Dr. Juan Manuel Olarte' && h.especialista === 'Dra. Sara López') return `${guionReasignacion(p, ctx)} ${cupo}`;
  const g = oficial(13);
  return `${rellenar(ctx.tono === 'tu' ? g.texto : g.usted, { ...p, especialista: h.especialista }, ctx).replace(/¿Prefiere.*$/, '')}${cupo}`;
}
