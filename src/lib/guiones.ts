import type { Hueco, Paciente, Profesional } from '../types';
import { GUIONES } from '../data/guiones';
import { pasoActual, riesgoAlto } from './reglas';

// "Ofrecer cita con otro profesional": reasignación por viaje del Dr. Olarte (fila 10 del Excel)
export const N_REASIGNACION = 9;
export const N_UBICACION = 24;

export interface Contexto {
  asesora: string;
  nuevaFecha?: string; // YYYY-MM-DD
  nuevaHora?: string; // HH:MM
}

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
const SARA = ['de la Dra. Sara López', 'la Dra. Sara López'];
const OLARTE = ['del Dr. Juan Manuel Olarte', 'el Dr. Juan Manuel Olarte'];
function ajustarDoctor(texto: string, doctor: Profesional) {
  const tieneSara = texto.includes('Dra. Sara López');
  const tieneOlarte = texto.includes('Dr. Juan Manuel Olarte');
  if (tieneSara === tieneOlarte) return texto; // nombra a los dos (o a ninguno): se deja igual
  const [de, a] = doctor === 'Dr. Juan Manuel Olarte' ? [SARA, OLARTE] : [OLARTE, SARA];
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
    .replaceAll('[FECHA]', fechaLarga(p.ultimaCita?.fecha) || '[FECHA]')
    .replaceAll('[HORA]', horaLarga(p.ultimaCita?.hora) || '[HORA]')
    .replaceAll('[VALOR]', p.valor ? Math.round(p.valor).toLocaleString('es-CO') : '[VALOR]');
  if (ctx.nuevaFecha) t = t.replaceAll('[NUEVA FECHA]', fechaLarga(ctx.nuevaFecha));
  if (ctx.nuevaHora) t = t.replaceAll('[NUEVA HORA]', horaLarga(ctx.nuevaHora));
  return opciones.doctor === false ? t : ajustarDoctor(t, p.especialista);
}

export const oficial = (n: number) => GUIONES.find((g) => g.n === n)!;

const comoGuion = (n: number, p: Paciente, ctx: Contexto, doctor = true): Guion => {
  const g = oficial(n);
  return { id: String(n), titulo: `#${n} · ${g.situacion}`, categoria: g.categoria, texto: rellenar(g.texto, p, ctx, { doctor }) };
};

// Matriz 5.1 del SRS: qué guion va según el caso, la etapa 3-7-15 y las etiquetas
export function recomendados(p: Paciente, hoy: string): number[] {
  const paso = pasoActual(p, hoy) ?? 3;
  const r: number[] = [];
  if (p.etiquetas.includes('Convenio FLAIRES')) r.push(18);
  if (p.caso === 'cancelo' || p.caso === 'no_asistio') {
    if (p.motivo === 'salud') r.push(8);
    r.push(paso === 3 ? 7 : paso === 7 ? 11 : 12);
    if (p.especialista === 'Dr. Juan Manuel Olarte') r.push(N_REASIGNACION);
  }
  if (p.caso === 'diagnostico') r.push(13, 15, 4);
  if (p.caso === 'pausa') r.push(13, 15);
  if (p.caso === 'limpieza') r.push(10, 12, 17);
  if (p.estado === 'activo') r.unshift(6);
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
  const todos = GUIONES.map((g) => comoGuion(g.n, p, ctx, g.n !== N_REASIGNACION));
  return { sugeridos, todos };
}

export const guionReasignacion = (p: Paciente, ctx: Contexto) => comoGuion(N_REASIGNACION, p, ctx, false).texto;

// Mensaje para ofrecer un cupo de la agenda libre
export function guionHueco(p: Paciente, h: Hueco, ctx: Contexto): string {
  const cupo = `Tenemos un cupo el ${fechaLarga(h.fecha)} a las ${horaLarga(h.hora)} en BLISSENS ODONTOLOGÍA, El Tesoro, torre médica 2, consultorio 1157. ¿Te lo apartamos?`;
  if (p.especialista === 'Dr. Juan Manuel Olarte' && h.especialista === 'Dra. Sara López') return `${guionReasignacion(p, ctx)} ${cupo}`;
  return `${rellenar(oficial(13).texto, { ...p, especialista: h.especialista }, ctx).replace(/¿Prefieres.*$/, '')}${cupo}`;
}
