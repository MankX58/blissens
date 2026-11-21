import type { Campana, Cita, Contacto, Datos, Hueco, Paciente } from '../types';
import { FRICCION } from './excel';
import { CASO_TXT, ESTADO_TXT, GRUPO_TXT, MOTIVO_TXT, RESULTADO_TXT, fechaCorta } from './reglas';

export type TipoEvento = 'cita' | 'evento' | 'contacto' | 'agenda' | 'campana' | 'nota' | 'cierre';
export interface Evento {
  fecha: string;
  tipo: TipoEvento;
  titulo: string;
  detalle?: string;
  tono: 'ok' | 'mal' | 'neutro';
}

const contactoEvento = (c: Contacto): Evento => ({
  fecha: c.fecha,
  tipo: 'contacto',
  titulo: `Intento día ${c.paso} · ${RESULTADO_TXT[c.resultado]}`,
  detalle: [c.nota, c.mensaje.startsWith('(') ? '' : `“${c.mensaje}”`].filter(Boolean).join(' — '),
  tono: c.resultado === 'agendo' ? 'ok' : c.resultado === 'no_interesa' ? 'mal' : 'neutro',
});

// Todo lo que le ha pasado al paciente, del más reciente al más antiguo
export function lineaDeTiempo(p: Paciente, huecos: Hueco[], campanas: Campana[], citas: Cita[] = []): Evento[] {
  const ev: Evento[] = [];
  const num = Number(p.idPaciente.slice(1));
  // citas reales del software, en orden cronológico (en un mismo día la primera fila del Excel es la más reciente)
  citas
    .filter((c) => c.paciente === num)
    .sort((a, b) => (a.fecha === b.fecha ? b.orden - a.orden : a.fecha < b.fecha ? -1 : 1))
    .forEach((c) =>
      ev.push({
        fecha: c.fecha,
        tipo: 'cita',
        titulo: `Cita de ${c.tipo.toLowerCase()} · ${c.estado}`,
        detalle: [c.profesional, c.hora, c.comentario].filter(Boolean).join(' · '),
        tono: c.estado === 'Atendido' ? 'ok' : FRICCION.includes(c.estado) ? 'mal' : 'neutro',
      })
    );
  for (const c of p.ciclos) {
    ev.push({ fecha: c.fechaEvento, tipo: 'evento', titulo: CASO_TXT[c.caso], detalle: 'Proceso anterior', tono: 'neutro' });
    c.contactos.forEach((x) => ev.push(contactoEvento(x)));
    const fin = c.contactos.at(-1)?.fecha ?? c.fechaEvento;
    ev.push({ fecha: fin, tipo: 'cierre', titulo: `Proceso cerrado · ${ESTADO_TXT[c.cierre]}`, tono: c.cierre === 'recuperado' ? 'ok' : 'neutro' });
  }
  if (p.estado !== 'activo') ev.push({ fecha: p.fechaEvento, tipo: 'evento', titulo: `Entra a seguimiento · ${CASO_TXT[p.caso]}`, detalle: 'Desde aquí corre la regla 3-7-15', tono: 'mal' });
  p.contactos.forEach((x) => ev.push(contactoEvento(x)));

  for (const h of huecos) {
    for (const o of h.ofertas.filter((o) => o.pacienteId === p.id))
      ev.push({ fecha: o.fecha, tipo: 'agenda', titulo: o.rechazo ? 'Se le ofreció un cupo · no pudo' : 'Se le ofreció un cupo', detalle: `${fechaCorta(h.fecha)} ${h.hora} · ${h.especialista.split(' · ')[0]}`, tono: 'neutro' });
    if (h.ocupadoPor === p.id) {
      ev.push({ fecha: h.asignadoEl ?? h.fecha, tipo: 'agenda', titulo: 'Agendado en agenda libre', detalle: `${fechaCorta(h.fecha)} ${h.hora} · ${h.especialista.split(' · ')[0]}`, tono: 'ok' });
      if (h.asistencia)
        ev.push({ fecha: h.fecha, tipo: 'agenda', titulo: h.asistencia === 'asistio' ? 'Asistió a la cita' : 'No asistió a la cita', tono: h.asistencia === 'asistio' ? 'ok' : 'mal' });
    }
  }
  for (const c of campanas)
    for (const e of c.envios.filter((e) => e.pacienteId === p.id && e.fecha && e.estado !== 'pendiente'))
      ev.push({
        fecha: e.fecha!.slice(0, 10),
        tipo: 'campana',
        titulo: `Campaña “${c.nombre}”`,
        detalle: e.estado === 'fallo' ? `No se pudo enviar: ${e.error}` : e.estado === 'respondio' ? 'Respondió' : 'Mensaje enviado',
        tono: e.estado === 'respondio' ? 'ok' : e.estado === 'fallo' ? 'mal' : 'neutro',
      });
  p.notas.forEach((n) => ev.push({ fecha: n.fecha, tipo: 'nota', titulo: 'Nota interna', detalle: n.texto, tono: 'neutro' }));

  return ev.map((e, i) => ({ e, i })).sort((a, b) => (a.e.fecha === b.e.fecha ? b.i - a.i : a.e.fecha < b.e.fecha ? 1 : -1)).map((x) => x.e);
}

// ---------- tablas (las mismas que se descargan en Excel) ----------
export type Fila = Record<string, string | number>;
export interface Hoja {
  id: string;
  nombre: string;
  filas: Fila[];
}

const estadoHueco = (h: Hueco, hoy: string) =>
  h.asistencia === 'asistio' ? 'Asistió' : h.asistencia === 'no_asistio' ? 'No asistió' : h.ocupadoPor ? 'Asignado' : h.fecha < hoy ? 'Se perdió' : 'Disponible';

export function hojas(d: Datos, hoy: string): Hoja[] {
  const nombre = (id?: string) => d.pacientes.find((p) => p.id === id)?.nombre ?? '';
  const nombrePorNum = new Map(d.pacientes.map((p) => [p.idPaciente, p.nombre]));
  return [
    {
      id: 'citas',
      nombre: 'Citas',
      filas: d.citas
        .slice()
        .sort((a, b) => (a.fecha === b.fecha ? a.orden - b.orden : a.fecha < b.fecha ? 1 : -1))
        .map((c) => ({
          '# Cita': c.id,
          Fecha: c.fecha,
          Hora: c.hora ?? '',
          '# Paciente': `#${c.paciente}`,
          Paciente: nombrePorNum.get(`#${c.paciente}`) ?? '',
          Estado: c.estado,
          Tipo: c.tipo,
          Profesional: c.profesional,
          Comentario: c.comentario ?? '',
        })),
    },
    {
      id: 'seguimiento',
      nombre: 'Seguimiento',
      filas: d.pacientes
        .flatMap((p) => [...p.ciclos.flatMap((c) => c.contactos), ...p.contactos].map((c) => ({ p, c })))
        .sort((a, b) => (a.c.fecha < b.c.fecha ? 1 : -1))
        .map(({ p, c }) => ({
          Fecha: c.fecha,
          Paciente: p.nombre,
          Caso: CASO_TXT[p.caso],
          Intento: `Día ${c.paso}`,
          Resultado: RESULTADO_TXT[c.resultado],
          Motivo: MOTIVO_TXT[p.motivo],
          Nota: c.nota ?? '',
          Especialista: p.especialista,
          Valor: p.valor,
        })),
    },
    {
      id: 'pacientes',
      nombre: 'Pacientes',
      filas: d.pacientes.map((p) => ({
        '# Paciente': p.idPaciente,
        Paciente: p.nombre,
        Antigüedad: p.antiguedad,
        'Segmento SRS': `${p.grupo}. ${GRUPO_TXT[p.grupo]}`,
        'Fallos seguidos': p.fallosSeguidos,
        'Fallos en total': p.fallosHistoricos,
        Riesgo: p.nivelRiesgo,
        Etiquetas: p.etiquetas.join(', '),
        Correo: p.email,
        Celular: p.telefono,
        Caso: CASO_TXT[p.caso],
        'Fecha evento': p.fechaEvento,
        Tratamiento: p.tratamiento,
        Especialista: p.especialista.split(' · ')[0],
        Valor: p.valor,
        Estado: ESTADO_TXT[p.estado],
        Intentos: p.contactos.length,
        Motivo: MOTIVO_TXT[p.motivo],
        'Recuperado el': p.recuperadoEl ?? '',
      })),
    },
    {
      id: 'agenda',
      nombre: 'Agenda libre',
      filas: [...d.huecos]
        .sort((a, b) => (a.fecha + a.hora < b.fecha + b.hora ? 1 : -1))
        .map((h) => ({
          Fecha: h.fecha,
          Hora: h.hora,
          Minutos: h.minutos,
          Especialista: h.especialista.split(' · ')[0],
          Estado: estadoHueco(h, hoy),
          Paciente: nombre(h.ocupadoPor),
          'Asignado el': h.asignadoEl ?? '',
          Ofrecido: h.ofertas.length,
          'Confirmada el': h.confirmadoEl ?? '',
        })),
    },
    {
      id: 'campanas',
      nombre: 'Campañas',
      filas: d.campanas.flatMap((c) =>
        c.envios.map((e) => ({
          Campaña: c.nombre,
          Paciente: e.nombre,
          Celular: e.telefono,
          Estado: { pendiente: 'Pendiente', enviado: 'Enviado', respondio: 'Respondió', fallo: 'Falló', omitido: 'Omitido' }[e.estado],
          'Fecha envío': e.fecha ? e.fecha.slice(0, 16).replace('T', ' ') : '',
          Canal: c.canal === 'api' ? 'WhatsApp API' : 'Simulación',
          Error: e.error ?? '',
        }))
      ),
    },
  ];
}
