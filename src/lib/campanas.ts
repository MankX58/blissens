import type { Campana, Paciente } from '../types';

export interface Audiencia {
  id: string;
  titulo: string;
  descripcion: string;
  filtro: (p: Paciente) => boolean;
  plantilla: string;
}

export const AUDIENCIAS: Audiencia[] = [
  {
    id: 'sin_reagendar',
    titulo: 'Sin reagendar',
    descripcion: 'Segmento 1: cancelaron o no asistieron',
    filtro: (p) => p.grupo === 1,
    plantilla:
      'Hola, {nombre}. Te escribimos de BLISSENS ODONTOLOGÍA. Tu última cita con {especialista} no se pudo realizar y queremos ayudarte a reprogramarla para que no pierdas el avance de {tratamiento}. ¿Te queda mejor en la mañana o en la tarde?',
  },
  {
    id: 'diagnostico',
    titulo: 'Diagnóstico sin tratamiento',
    descripcion: 'Segmento 2: valorados que no iniciaron',
    filtro: (p) => p.grupo === 2,
    plantilla:
      'Hola, {nombre}. Te escribimos de parte de {especialista}. Después de tu valoración quedó pendiente iniciar tu plan de tratamiento. Si tienes dudas sobre el plan, los tiempos o las formas de pago, con gusto te las resolvemos. ¿Agendamos una cita para empezar?',
  },
  {
    id: 'pausa',
    titulo: 'Tratamiento en pausa',
    descripcion: 'Segmento 3: más de 30 días sin volver',
    filtro: (p) => p.caso === 'pausa',
    plantilla:
      'Hola, {nombre}. Te escribimos de parte de {especialista}. Hace un tiempo no te vemos y tenemos pendiente continuar {tratamiento}. Retomarlo a tiempo ayuda a que el resultado sea el esperado. ¿Prefieres una cita en la mañana o en la tarde?',
  },
  {
    id: 'limpieza',
    titulo: 'Control de limpieza',
    descripcion: 'Limpieza o revisión cada 4 a 6 meses',
    filtro: (p) => p.caso === 'limpieza',
    plantilla:
      'Hola, {nombre}. En BLISSENS ODONTOLOGÍA sabemos que tienes muchas ocupaciones, por eso te recordamos que ya es momento de tu limpieza y revisión con {especialista}. ¿Agendamos tu cita? ¿Prefieres en la mañana o en la tarde?',
  },
  {
    id: 'riesgo',
    titulo: 'Riesgo alto',
    descripcion: '3+ citas seguidas sin asistir: buscar un horario que sí le sirva',
    filtro: (p) => p.fallosSeguidos >= 3,
    plantilla:
      'Hola, {nombre}. Sabemos que en los últimos meses ha sido difícil coincidir con tu cita y queremos ayudarte a encontrar un horario que de verdad te funcione. Cuéntanos qué día y franja te quedan mejor y te agendamos con {especialista}. Te esperamos en El Tesoro, torre médica 2, consultorio 1157.',
  },
  {
    id: 'vip',
    titulo: 'Pacientes VIP',
    descripcion: 'Internacionales, deportistas y tratamientos de alto valor',
    filtro: (p) => p.etiquetas.includes('VIP'),
    plantilla:
      'Hola, {nombre}. Te escribimos de parte de {especialista}. Queremos acompañarte de cerca para continuar {tratamiento}: podemos agendarte una cita en la clínica o, si te queda más fácil, una valoración virtual. ¿Qué opción prefieres?',
  },
  {
    id: 'flaires',
    titulo: 'Convenio FLAIRES',
    descripcion: 'Bono de limpieza (guion oficial #18)',
    filtro: (p) => p.etiquetas.includes('Convenio FLAIRES'),
    plantilla:
      'Hola, {nombre}. Te recordamos que, por ser parte de FLAIRES, tienes un bono para una limpieza dental en BLISSENS ODONTOLOGÍA. ¡Nos encantaría conocerte y ayudarte a hacer efectivo tu bono! ¿Agendamos tu cita?',
  },
  {
    id: 'agotado',
    titulo: 'Sin respuesta al 3-7-15',
    descripcion: 'El rescate del día 15 no funcionó',
    filtro: (p) => p.estado === 'agotado',
    plantilla:
      'Hola, {nombre}. Te saludamos de BLISSENS ODONTOLOGÍA. Hace un tiempo no vienes a control y queremos saber cómo estás. Si quieres retomar {tratamiento} o hacer una revisión, aquí estamos para ayudarte. ¿Te gustaría que te agendáramos?',
  },
];

// El comentario de la cita viene como "LAB Corona 37" o "Revision ": se traduce a algo que se pueda leer en un mensaje
const TRATAMIENTOS: [RegExp, string][] = [
  [/alin|refinamiento/, 'tu tratamiento con alineadores'],
  [/ortodon|retenedor|retendor/, 'tu tratamiento de ortodoncia'],
  [/implante/, 'tu tratamiento de implantes'],
  [/corona|\blab\b|cementaci/, 'tu corona'],
  [/carilla/, 'tus carillas'],
  [/blanque/, 'tu blanqueamiento'],
  [/limpieza|profilax/, 'tu limpieza dental'],
  [/resina/, 'tus resinas'],
  [/desprogramador|placa|bruxismo/, 'tu placa'],
  [/cordal|cirug/, 'tu cirugía'],
  [/endodon/, 'tu endodoncia'],
  [/provisional|\bprovi\b/, 'tu rehabilitación'],
];
export function tratamientoLegible(p: Paciente): string {
  const t = p.tratamiento.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const hit = TRATAMIENTOS.find(([re]) => re.test(t));
  if (hit) return hit[1];
  return p.caso === 'diagnostico' ? 'tu plan de tratamiento' : 'tu tratamiento';
}

export const personalizar = (plantilla: string, p: Paciente) =>
  plantilla
    .replaceAll('{nombre}', p.nombre.split(' ')[0])
    .replaceAll('{tratamiento}', tratamientoLegible(p))
    .replaceAll('{especialista}', p.especialista === 'Dra. Sara López' ? 'la Dra. Sara López' : 'el Dr. Juan Manuel Olarte')
    .replaceAll(' de el Dr.', ' del Dr.')
    .replaceAll(' a el Dr.', ' al Dr.');

// Qué tiene que hacer el motor con esta campaña ahora mismo
export type Paso = { tipo: 'nada' } | { tipo: 'completar' } | { tipo: 'enviar'; idx: number };
export function siguientePaso(c: Campana, ahora: number): Paso {
  const activa = c.estado === 'enviando' || (c.estado === 'programada' && Date.parse(c.inicio) <= ahora);
  if (!activa) return { tipo: 'nada' };
  const idx = c.envios.findIndex((e) => e.estado === 'pendiente');
  if (idx < 0) return { tipo: 'completar' };
  const ultimo = Math.max(0, ...c.envios.map((e) => (e.fecha && e.estado !== 'pendiente' ? Date.parse(e.fecha) : 0)));
  if (ahora - ultimo < c.ritmoSeg * 1000) return { tipo: 'nada' };
  return { tipo: 'enviar', idx };
}

// El envío real lo hace el backend (POST /campanas/{id}/ejecutar-lote); el token de WhatsApp vive en su .env.

export const ESTADO_CAMPANA_TXT: Record<Campana['estado'], string> = {
  programada: 'Programada',
  enviando: 'Enviando',
  pausada: 'En pausa',
  completada: 'Completada',
  cancelada: 'Cancelada',
};
