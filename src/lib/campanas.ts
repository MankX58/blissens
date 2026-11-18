import type { Campana, ConfigWA, Paciente } from '../types';
import { soloDigitos } from './reglas';

export interface Audiencia {
  id: string;
  titulo: string;
  descripcion: string;
  filtro: (p: Paciente) => boolean;
  plantilla: string;
}

export const AUDIENCIAS: Audiencia[] = [
  {
    id: 'internacional',
    titulo: 'Internacionales',
    descripcion: 'Turismo médico: viaje, hotel y transporte',
    filtro: (p) => p.segmento === 'internacional',
    plantilla:
      'Hola {nombre}, te saludamos de Blissens en Medellín. Si estás planeando tu viaje a Colombia, coordinamos tu {tratamiento} con {especialista} junto con hotel y transporte. ¿Agendamos una videollamada corta?',
  },
  {
    id: 'deportista',
    titulo: 'Deportistas',
    descripcion: 'Horarios flexibles según entrenamientos',
    filtro: (p) => p.segmento === 'deportista',
    plantilla:
      'Hola {nombre}, en Blissens tenemos horarios flexibles para deportistas. Retomemos tu {tratamiento} sin afectar tus entrenamientos. ¿Cuándo tienes un espacio?',
  },
  {
    id: 'diagnostico',
    titulo: 'Diagnóstico sin iniciar',
    descripcion: 'Planes valorados que no han comenzado',
    filtro: (p) => p.caso === 'diagnostico',
    plantilla: 'Hola {nombre}, este mes tenemos facilidades para iniciar tu {tratamiento} por etapas. ¿Te contamos cómo funciona?',
  },
  {
    id: 'limpieza',
    titulo: 'Control de limpieza',
    descripcion: 'Mantenimiento preventivo vencido',
    filtro: (p) => p.caso === 'limpieza',
    plantilla: 'Hola {nombre}, ya es momento de tu control de limpieza en Blissens. ¿Te reservamos un espacio esta semana?',
  },
  {
    id: 'agotado',
    titulo: 'Sin respuesta al 3-7-15',
    descripcion: 'Terminaron los tres intentos sin contestar',
    filtro: (p) => p.estado === 'agotado',
    plantilla:
      'Hola {nombre}, hace un tiempo no sabemos de ti y queremos saber cómo sigues. Si quieres retomar tu {tratamiento}, aquí estamos para ayudarte.',
  },
  {
    id: 'alto',
    titulo: 'Alto valor',
    descripcion: 'Planes desde $10 M o segmentos prioritarios',
    filtro: (p) => p.segmento !== 'local' || p.valor >= 10_000_000,
    plantilla:
      'Hola {nombre}, {especialista} reservó espacios prioritarios este mes para continuar tu {tratamiento}. ¿Te apartamos uno?',
  },
];

export const personalizar = (plantilla: string, p: Paciente) =>
  plantilla
    .replaceAll('{nombre}', p.nombre.split(' ')[0])
    .replaceAll('{tratamiento}', p.tratamiento.toLowerCase())
    .replaceAll('{especialista}', p.especialista.split(' · ')[0]);

export const apiConectada = (c: ConfigWA) => !!(c.token.trim() && c.phoneId.trim());

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

// Envío real por WhatsApp Business Cloud API (Meta).
// Fuera de la ventana de 24 h WhatsApp exige una plantilla aprobada; si hay una configurada se usa con {nombre} como variable.
// ponytail: el token vive en el navegador; en producción debe ir en un servidor propio que haga esta llamada.
export async function enviarPorAPI(cfg: ConfigWA, telefono: string, texto: string, nombre: string) {
  const to = soloDigitos(telefono);
  const body = cfg.plantilla.trim()
    ? {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: cfg.plantilla.trim(),
          language: { code: cfg.idioma || 'es' },
          components: [{ type: 'body', parameters: [{ type: 'text', text: nombre.split(' ')[0] }] }],
        },
      }
    : { messaging_product: 'whatsapp', to, type: 'text', text: { body: texto } };
  const r = await fetch(`https://graph.facebook.com/v21.0/${cfg.phoneId.trim()}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.token.trim()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => null);
    throw new Error(j?.error?.message ?? `Error ${r.status}`);
  }
}

export const ESTADO_CAMPANA_TXT: Record<Campana['estado'], string> = {
  programada: 'Programada',
  enviando: 'Enviando',
  pausada: 'En pausa',
  completada: 'Completada',
  cancelada: 'Cancelada',
};
