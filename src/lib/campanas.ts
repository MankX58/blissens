import type { Campana, Paciente } from '../types';
import { conArticulo, diasEntre, esInternacional } from './reglas';

export interface Audiencia {
  id: string;
  titulo: string;
  descripcion: string;
  filtro: (p: Paciente, hoy: string) => boolean;
  plantilla: string;
  estados?: Paciente['estado'][]; // por defecto: en seguimiento o sin respuesta al 3-7-15
}

// Trato de «usted», cálido, nombrando al doctor (lo que mejor le funciona a la clínica)
export const AUDIENCIAS: Audiencia[] = [
  {
    id: 'sin_reagendar',
    titulo: 'Sin reagendar',
    descripcion: 'Cancelaron o no asistieron y no han vuelto a agendar',
    filtro: (p) => p.grupo === 1,
    plantilla:
      'Hola, {nombre}. Le escribimos de BLISSENS ODONTOLOGÍA, de parte de {especialista}. Su última cita no se pudo realizar y queremos ayudarle a reprogramarla para que no pierda el avance de {tratamiento}. ¿Le queda mejor en la mañana o en la tarde?',
  },
  {
    id: 'abonos',
    titulo: 'Acompañamiento después de la valoración',
    descripcion: 'Días 3 y 7: recordatorio amable para iniciar el plan (no es cobro)',
    filtro: (p, hoy) => p.pasoAbono === 3 || p.pasoAbono === 7 || p.tocaAbonoHoy === true || (p.pasoAbono === undefined && p.grupo === 2 && [3, 4, 5, 6, 7, 8].includes(diasEntre(p.fechaEvento, hoy))),
    plantilla:
      'Hola, {nombre}. ¿Cómo ha estado después de su valoración con {especialista}? Queremos acompañarle para empezar su plan de tratamiento. Si desea, le contamos las formas de pago y organizamos el plan por etapas. ¿Le separamos su primera cita?',
  },
  {
    id: 'diagnostico',
    titulo: 'Diagnóstico sin tratamiento',
    descripcion: 'Valorados que no iniciaron',
    filtro: (p) => p.grupo === 2,
    plantilla:
      'Hola, {nombre}. Le escribimos de parte de {especialista}. Después de su valoración quedó pendiente iniciar su plan de tratamiento. Si tiene dudas sobre el plan, los tiempos o las formas de pago, con gusto se las resolvemos. ¿Agendamos una cita para empezar?',
  },
  {
    id: 'volver',
    titulo: 'Volver a empezar',
    descripcion: 'Perdidos: más de 60 días sin volver',
    filtro: (p, hoy) => p.perdido60 ?? diasEntre(p.fechaEvento, hoy) > 60,
    plantilla:
      'Hola, {nombre}. ¡Le extrañamos en BLISSENS ODONTOLOGÍA! Siempre es un buen momento para volver a empezar: {especialista} quiere ayudarle a retomar {tratamiento}. ¿Le gustaría que le agendáramos una cita en la mañana o en la tarde?',
  },
  {
    id: 'pausa',
    titulo: 'Tratamiento en pausa',
    descripcion: 'Más de 30 días sin volver',
    filtro: (p) => p.caso === 'pausa',
    plantilla:
      'Hola, {nombre}. Le escribimos de parte de {especialista}. Hace un tiempo no le vemos y tenemos pendiente continuar {tratamiento}. Retomarlo a tiempo ayuda a que el resultado sea el esperado. ¿Prefiere una cita en la mañana o en la tarde?',
  },
  {
    id: 'limpieza',
    titulo: 'Controles',
    descripcion: 'Limpieza cada 6 meses · ortodoncia y alineadores cada mes',
    filtro: (p) => p.caso === 'limpieza',
    plantilla:
      'Hola, {nombre}. En BLISSENS ODONTOLOGÍA sabemos que usted tiene muchas ocupaciones, por eso le recordamos que ya es momento de su control con {especialista}. ¿Agendamos su cita? ¿Prefiere en la mañana o en la tarde?',
  },
  {
    id: 'riesgo',
    titulo: 'Riesgo alto',
    descripcion: '3+ citas seguidas sin asistir: buscar un horario que sí le sirva',
    filtro: (p) => p.fallosSeguidos >= 3,
    plantilla:
      'Hola, {nombre}. Sabemos que en los últimos meses ha sido difícil coincidir con su cita y queremos ayudarle a encontrar un horario que de verdad le funcione. Cuéntenos qué día y franja le quedan mejor y le agendamos con {especialista}. Le esperamos en El Tesoro, torre médica 2, consultorio 1157.',
  },
  {
    id: 'vip',
    titulo: 'Pacientes VIP',
    descripcion: 'Deportistas y tratamientos de alto valor',
    filtro: (p) => p.etiquetas.includes('VIP') && !esInternacional(p),
    plantilla:
      'Hola, {nombre}. Le escribimos de parte de {especialista}. Queremos acompañarle de cerca para continuar {tratamiento}: podemos agendarle una cita en la clínica o, si le queda más fácil, una valoración virtual. ¿Qué opción prefiere?',
  },
  {
    id: 'internacionales',
    titulo: 'Internacionales (English)',
    descripcion: 'Pacientes de afuera: se quedan 1-2 semanas, mensaje en inglés',
    filtro: (p) => esInternacional(p),
    plantilla:
      'Hello, {nombre}. We are writing from BLISSENS ODONTOLOGÍA on behalf of {doctor}. We would love to help you continue your treatment. We know your time in Medellín is limited, so we can arrange your appointments to fit your stay, or offer a virtual consultation. When would be a good time for you?',
  },
  {
    id: 'referidos',
    titulo: 'Referidos y embajadores',
    descripcion: 'Pacientes recuperados o activos: invitarlos a recomendar la clínica',
    estados: ['recuperado', 'activo'],
    filtro: () => true,
    plantilla:
      'Hola, {nombre}. Gracias por confiarnos su sonrisa en BLISSENS ODONTOLOGÍA. Si alguien de su familia, su equipo o sus amigos quiere empezar a cuidar la suya, puede compartirle este número: le atenderemos con el mismo cariño. «Tu futura sonrisa» también puede ser la de ellos.',
  },
  {
    id: 'flaires',
    titulo: 'Convenio FLAIRES',
    descripcion: 'Bono de limpieza (guion oficial #18)',
    filtro: (p) => p.etiquetas.includes('Convenio FLAIRES'),
    plantilla:
      'Hola, {nombre}. Le recordamos que, por ser parte de FLAIRES, tiene un bono para una limpieza dental en BLISSENS ODONTOLOGÍA. ¡Nos encantaría conocerle y ayudarle a hacer efectivo su bono! ¿Agendamos su cita?',
  },
  {
    id: 'agotado',
    titulo: 'Sin respuesta al 3-7-15',
    descripcion: 'El rescate del día 15 no funcionó',
    filtro: (p) => p.estado === 'agotado',
    plantilla:
      'Hola, {nombre}. Le saludamos de BLISSENS ODONTOLOGÍA. Hace un tiempo no viene a control y queremos saber cómo está. Si quiere retomar {tratamiento} o hacer una revisión, aquí estamos para ayudarle. ¿Le gustaría que le agendáramos?',
  },
];

// El comentario de la cita viene como "LAB Corona 37" o "Revision ": se traduce a algo que se pueda leer en un mensaje
const TRATAMIENTOS: [RegExp, string][] = [
  [/alin|refinamiento/, 'su tratamiento con alineadores'],
  [/ortodon|retenedor|retendor/, 'su tratamiento de ortodoncia'],
  [/implante/, 'su tratamiento de implantes'],
  [/corona|\blab\b|cementaci/, 'su corona'],
  [/carilla/, 'sus carillas'],
  [/blanque/, 'su blanqueamiento'],
  [/limpieza|profilax/, 'su limpieza dental'],
  [/resina/, 'sus resinas'],
  [/desprogramador|placa|bruxismo/, 'su placa'],
  [/cordal|cirug/, 'su cirugía'],
  [/endodon/, 'su endodoncia'],
  [/provisional|\bprovi\b/, 'su rehabilitación'],
];
export function tratamientoLegible(p: Paciente): string {
  const t = p.tratamiento.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const hit = TRATAMIENTOS.find(([re]) => re.test(t));
  if (hit) return hit[1];
  return p.caso === 'diagnostico' ? 'su plan de tratamiento' : 'su tratamiento';
}

export const personalizar = (plantilla: string, p: Paciente) =>
  plantilla
    .replaceAll('{nombre}', p.nombre.split(' ')[0])
    .replaceAll('{tratamiento}', tratamientoLegible(p))
    .replaceAll('{especialista}', conArticulo(p.especialista))
    .replaceAll('{doctor}', p.especialista)
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

// Siguiente momento hábil de recepción (lun-vie 8-12 / 13-17) para programar lo que se intentó fuera de horario
export function proximoHorario(d = new Date()): Date {
  const x = new Date(d);
  for (let i = 0; i < 8 * 24; i++) {
    const h = x.getHours();
    if (x.getDay() >= 1 && x.getDay() <= 5 && ((h >= 8 && h < 12) || (h >= 13 && h < 17))) return x;
    x.setHours(h + 1, 0, 0, 0);
  }
  return x;
}
