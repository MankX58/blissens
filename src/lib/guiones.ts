import type { Hueco, Paciente } from '../types';
import { fechaCorta, pasoActual } from './reglas';

export interface Guion {
  titulo: string;
  texto: string;
}

const primerNombre = (p: Paciente) => p.nombre.split(' ')[0];
const doctor = (p: Paciente) => p.especialista.split(' · ')[0];

// Guion principal según caso + intento de la regla 3-7-15
function guionPrincipal(p: Paciente): string {
  const n = primerNombre(p);
  const dr = doctor(p);
  const t = p.tratamiento.toLowerCase();
  const paso = pasoActual(p) ?? 3;

  if (p.caso === 'cancelo' || p.caso === 'no_asistio') {
    const porque = p.caso === 'cancelo' ? 'tuviste que cancelar tu cita' : 'no pudiste venir a tu cita';
    if (paso === 3)
      return `Hola ${n}, te saludamos de Blissens Odontología. Vimos que ${porque} con ${dr} y queremos ayudarte a encontrar un nuevo horario para seguir con tu ${t}. ¿Qué día te queda mejor esta semana?`;
    if (paso === 7)
      return `Hola ${n}, ¿cómo vas? Te escribimos de nuevo desde Blissens porque tu cita de ${t} sigue pendiente. ¿Te sirve más en la mañana o al final de la tarde? Te la apartamos de una.`;
    return `Hola ${n}, no queremos que pierdas el avance de tu ${t} con ${dr}. Esta semana tenemos dos espacios prioritarios en El Tesoro. Si algo te detiene (horario, costos, traslado), cuéntanos y buscamos la mejor opción contigo.`;
  }

  if (p.caso === 'diagnostico') {
    if (paso === 3)
      return `Hola ${n}, qué gusto saludarte desde Blissens. ¿Te quedó alguna duda sobre el plan de ${t} que te explicó ${dr}? Ya tenemos agenda para empezar cuando quieras.`;
    if (paso === 7)
      return `Hola ${n}, queríamos saber si pudiste revisar tu plan de ${t}. Si te sirve, podemos dividirlo por etapas o revisar opciones de abono para que empieces sin afanes.`;
    return `Hola ${n}, han pasado unos días desde tu valoración de ${t} con ${dr}. Para cuidar tu salud dental lo ideal es no dejarlo pasar mucho más. ¿Te llamamos hoy 5 minutos y resolvemos todo?`;
  }

  // limpieza
  if (paso === 15)
    return `Hola ${n}, en Blissens cuidamos que tu tratamiento dure muchos años. Tu control de limpieza ya está vencido; esta semana tenemos espacio en El Tesoro. ¿Te agendamos?`;
  return `Hola ${n}, te saludamos de Blissens Odontología. Ya es momento de tu control de limpieza y mantenimiento. ¿Te reservamos un espacio esta semana?`;
}

function guionIngles(p: Paciente): string {
  const n = primerNombre(p);
  const dr = doctor(p);
  return `Hi ${n}, warm greetings from Blissens Dental Studio in Medellín. ${dr} asked us to follow up on your ${p.tratamiento.toLowerCase()} plan. We can set up a quick video call and coordinate your trip, hotel and transport whenever you're ready. What dates are you considering?`;
}

export function guionesPara(p: Paciente): Guion[] {
  const paso = pasoActual(p) ?? 3;
  const lista: Guion[] = [{ titulo: `Guion día ${paso}`, texto: guionPrincipal(p) }];
  if (p.segmento === 'internacional') {
    lista.push({ titulo: 'En inglés', texto: guionIngles(p) });
    lista.push({
      titulo: 'Viaje a Medellín',
      texto: `Hola ${primerNombre(p)}, si estás planeando tu próximo viaje a Colombia, coordinamos tu agenda con ${doctor(p)} junto con hotel y transporte en El Poblado. ¿Qué fechas tienes en mente?`,
    });
  }
  if (p.segmento === 'deportista')
    lista.push({
      titulo: 'Agenda flexible',
      texto: `Hola ${primerNombre(p)}, sabemos que tu calendario de entrenamientos y competencias es exigente. ${doctor(p)} puede atenderte en un horario que no afecte tu rutina. ¿Cuándo tienes descanso esta semana?`,
    });
  lista.push({
    titulo: 'Preguntar el motivo',
    texto: `Hola ${primerNombre(p)}, te saludamos de Blissens. Para ayudarte mejor, ¿nos cuentas qué te ha impedido continuar? Puede ser horario, traslado o forma de pago; tenemos opciones para cada caso.`,
  });
  return lista;
}

export function guionHueco(p: Paciente, h: Hueco): string {
  return `Hola ${primerNombre(p)}, se acaba de liberar un espacio con ${h.especialista.split(' · ')[0]} el ${fechaCorta(h.fecha)} a las ${h.hora} en Torre Médica 2 El Tesoro. ¿Te lo apartamos para avanzar con tu ${p.tratamiento.toLowerCase()}?`;
}
