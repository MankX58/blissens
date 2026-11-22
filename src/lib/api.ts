// Cliente del backend FastAPI (../blissens-backend). Vite pasa /api a :8000 con la cookie de sesión de Better Auth.
// El backend es la fuente de verdad: aquí solo se traducen sus respuestas (snake_case) al modelo del panel (src/types.ts).
import type { Campana, Caso, Cita, Contacto, Datos, Equipo, FuenteAgenda, Estado, EstadoEnvio, Franja, Grupo, Hueco, Motivo, NivelRiesgo, Paciente, Pausa, Profesional, Resultado, Segmento } from '../types';

const BASE = '/api/v1';

export class ErrorApi extends Error {
  constructor(
    mensaje: string,
    public status: number
  ) {
    super(mensaje);
  }
}

async function pedir<T>(ruta: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${ruta}`, {
    credentials: 'include',
    ...init,
    headers: init?.body instanceof FormData ? init.headers : { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!r.ok) {
    let mensaje = r.status === 502 || r.status === 504 ? 'El servidor de datos no responde. ¿Está corriendo el backend?' : `Error ${r.status}`;
    try {
      const e = await r.json();
      mensaje = e.mensaje ?? (typeof e.detail === 'string' ? e.detail : mensaje);
    } catch {
      /* sin cuerpo JSON */
    }
    throw new ErrorApi(mensaje, r.status);
  }
  return r.status === 204 ? (undefined as T) : r.json();
}
const post = <T>(ruta: string, cuerpo?: unknown) => pedir<T>(ruta, { method: 'POST', body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
const patch = <T>(ruta: string, cuerpo: unknown) => pedir<T>(ruta, { method: 'PATCH', body: JSON.stringify(cuerpo) });

// ---------- respuestas del backend ----------
interface ApiContacto {
  fecha: string;
  paso: number;
  resultado: string;
  mensaje: string;
  motivo: string;
  nota: string | null;
  hueco_id?: number | null;
}
interface ApiCita {
  numero_cita: number;
  fecha_cita: string;
  tipo_atencion: 'Diagnóstico' | 'Tratamiento';
  profesional: string;
  estado_actual: string;
  hora_inicio: string | null;
  comentario_cita: string | null;
}
export interface ApiPaciente {
  numero_paciente: number;
  nombre_completo: string;
  antiguedad_actual: string;
  segmento_cartera: 'sin_reagendar' | 'diagnostico' | 'pausa_control' | 'activo';
  perfil_comercial: Segmento;
  caso_seguimiento: string | null;
  estado_seguimiento: Exclude<Estado, 'activo'>;
  motivo_cancelacion: Motivo;
  profesional_principal: string;
  ultima_fecha_cita: string;
  ultimo_estado_cita: string;
  ultimo_comentario: string | null;
  telefono_normalizado: string | null;
  email: string | null;
  apoderado: string | null;
  fallos_historicos: number;
  fallos_seguidos: number;
  ultima_atendida: string | null;
  nivel_riesgo: 'bajo' | 'medio' | 'alto';
  etiquetas: string[];
  motivo_vip?: string | null;
  fecha_evento: string | null;
  valor_estimado_cop: number;
  valor_estimado_fuente: string;
  // solo en el expediente (campañas recibe la ficha resumida)
  accion_arancel_referencia?: string | null;
  recuperado_el?: string | null;
  origen?: 'excel' | 'manual';
  creado_el?: string;
  citas?: ApiCita[];
  contactos?: ApiContacto[];
  notas?: { fecha: string; texto: string }[];
  ciclos?: { caso: string; fecha_evento: string; cierre: string; motivo: string; contactos: ApiContacto[] }[];
}
interface ApiHueco {
  id: number;
  fecha: string;
  hora: string;
  minutos: number;
  profesional: string;
  origen?: 'calculado' | 'manual';
  verificacion?: 'libre' | 'ocupado' | null;
  ocupado_por: number | null;
  asignado_el: string | null;
  estado_previo: string | null;
  asistencia: 'asistio' | 'no_asistio' | null;
  confirmado_el: string | null;
  ofertas: { numero_paciente: number; fecha: string; rechazo: boolean }[];
}
interface ApiCampana {
  id: number;
  nombre: string;
  audiencia: string;
  plantilla: string;
  creada_el: string;
  inicio: string;
  ritmo_seg: number;
  canal: string;
  estado: Campana['estado'];
  envios: { id: number; numero_paciente: number; nombre_paciente: string; telefono: string; texto: string; estado: EstadoEnvio; fecha_envio: string | null; error: string | null }[];
}
export interface ApiPanel {
  rol: string | null;
  profesional: string | null;
  configuracion: { asesora: string; fecha_corte: string };
  whatsapp: { modo: 'simulacion' | 'meta_cloud'; conectado: boolean };
  pacientes: ApiPaciente[];
  huecos: ApiHueco[];
  campanas: ApiCampana[];
  agenda_sin_hora?: { fecha: string; profesional: string; citas: number }[];
  sin_horario?: string[];
  agenda_sin_citas?: number;
  agenda_cubierta_hasta?: string | null;
  ultima_carga?: string | null;
  carga_automatica?: boolean;
  fuente_agenda?: FuenteAgenda['tipo'];
  fuente_error?: string | null;
  cupos_ocupados?: ApiHueco[];
}
interface ApiEquipo {
  horarios: { profesional: string; franjas: { dia_semana: number; inicio: string; fin: string }[] }[];
  pausas: Pausa[];
  ausencias: { id: number; user_id: string; nombre: string; desde: string; hasta: string; motivo: string }[];
}

// ---------- traducción al modelo del panel ----------
const GRUPO: Record<ApiPaciente['segmento_cartera'], Grupo> = { sin_reagendar: 1, diagnostico: 2, pausa_control: 3, activo: 4 };
const RIESGO: Record<ApiPaciente['nivel_riesgo'], NivelRiesgo> = { bajo: 'Bajo', medio: 'Medio', alto: 'Alto' };
const conMas = (tel: string | null) => (tel ? (tel.startsWith('+') ? tel : `+${tel}`) : '');
// el backend guarda fechas-hora en UTC sin zona (SQLite); sin la Z el navegador las leería como hora local
const utc = (f: string) => (/[zZ]|[+-]\d\d:?\d\d$/.test(f) ? f : `${f}Z`);
const paso = (n: number) => (n === 7 || n === 15 ? n : 3) as 3 | 7 | 15;
const contacto = (c: ApiContacto): Contacto => ({
  fecha: c.fecha,
  paso: paso(c.paso),
  resultado: c.resultado as Resultado,
  mensaje: c.mensaje,
  nota: c.nota ?? undefined,
  huecoId: c.hueco_id != null ? String(c.hueco_id) : undefined,
});

export function adaptarPaciente(p: ApiPaciente): Paciente {
  const grupo = GRUPO[p.segmento_cartera];
  const ultima = p.citas?.[0];
  const ref = p.accion_arancel_referencia;
  return {
    id: String(p.numero_paciente),
    idPaciente: `#${p.numero_paciente}`,
    nombre: p.nombre_completo,
    telefono: conMas(p.telefono_normalizado),
    email: p.email ?? '',
    apoderado: p.apoderado ?? '',
    ciudad: '',
    segmento: p.perfil_comercial,
    antiguedad: p.antiguedad_actual === 'antiguo' ? 'Antiguo' : 'Nuevo',
    etiquetas: p.etiquetas,
    motivoVip: p.motivo_vip ?? undefined,
    grupo,
    fallosHistoricos: p.fallos_historicos,
    fallosSeguidos: p.fallos_seguidos,
    ultimaAtendida: p.ultima_atendida ?? undefined,
    nivelRiesgo: RIESGO[p.nivel_riesgo],
    caso: (p.caso_seguimiento ?? 'pausa') as Caso,
    fechaEvento: p.fecha_evento ?? p.ultima_fecha_cita,
    ultimaCita: {
      fecha: ultima?.fecha_cita ?? p.ultima_fecha_cita,
      hora: ultima?.hora_inicio ?? undefined,
      estado: ultima?.estado_actual ?? p.ultimo_estado_cita,
      tipo: ultima?.tipo_atencion ?? (grupo === 2 ? 'Diagnóstico' : 'Tratamiento'),
    },
    tratamiento: p.ultimo_comentario ?? ref ?? '',
    especialista: p.profesional_principal as Profesional,
    valor: p.valor_estimado_cop,
    valorReferencia: ref ? { acciones: ref.split(' + '), fuente: p.valor_estimado_fuente.includes('comentario') ? 'comentario' : 'tipo de cita' } : undefined,
    motivo: p.motivo_cancelacion,
    estado: grupo === 4 ? 'activo' : p.estado_seguimiento,
    contactos: (p.contactos ?? []).map(contacto),
    recuperadoEl: p.recuperado_el ?? undefined,
    notas: (p.notas ?? []).map((n) => ({ fecha: n.fecha, texto: n.texto })),
    ciclos: (p.ciclos ?? []).map((c) => ({ caso: c.caso as Caso, fechaEvento: c.fecha_evento, cierre: c.cierre as Estado, motivo: c.motivo as Motivo, contactos: c.contactos.map(contacto) })),
    origen: p.origen ?? 'excel',
    creadoEl: p.creado_el ?? p.ultima_fecha_cita,
  };
}

const citasDe = (p: ApiPaciente): Cita[] =>
  (p.citas ?? []).map((c, i) => ({
    id: c.numero_cita,
    paciente: p.numero_paciente,
    fecha: c.fecha_cita,
    hora: c.hora_inicio ?? undefined,
    estado: c.estado_actual,
    tipo: c.tipo_atencion,
    profesional: c.profesional as Profesional,
    comentario: c.comentario_cita ?? undefined,
    orden: i, // vienen de la más reciente a la más antigua
  }));

export const adaptarHueco = (h: ApiHueco): Hueco => ({
  id: String(h.id),
  fecha: h.fecha,
  hora: h.hora,
  minutos: h.minutos,
  especialista: h.profesional as Profesional,
  origen: h.origen ?? 'manual',
  verificacion: h.verificacion ?? undefined,
  ocupadoPor: h.ocupado_por != null ? String(h.ocupado_por) : undefined,
  asignadoEl: h.asignado_el ?? undefined,
  estadoPrevio: (h.estado_previo as Estado | null) ?? undefined,
  confirmadoEl: h.confirmado_el ?? undefined,
  asistencia: h.asistencia ?? undefined,
  ofertas: h.ofertas.map((o) => ({ pacienteId: String(o.numero_paciente), fecha: o.fecha, rechazo: o.rechazo || undefined })),
});

export const adaptarCampana = (c: ApiCampana): Campana => ({
  id: String(c.id),
  nombre: c.nombre,
  audiencia: c.audiencia,
  plantilla: c.plantilla,
  creadaEl: utc(c.creada_el),
  inicio: utc(c.inicio),
  ritmoSeg: c.ritmo_seg,
  canal: c.canal === 'api' ? 'api' : 'simulado',
  estado: c.estado,
  envios: c.envios.map((e) => ({
    id: String(e.id),
    pacienteId: String(e.numero_paciente),
    nombre: e.nombre_paciente,
    telefono: conMas(e.telefono),
    texto: e.texto,
    estado: e.estado,
    fecha: e.fecha_envio ? utc(e.fecha_envio) : undefined,
    error: e.error ?? undefined,
  })),
});

export const adaptarPanel = (p: ApiPanel): Datos => ({
  pacientes: p.pacientes.map(adaptarPaciente),
  citas: p.pacientes.flatMap(citasDe),
  huecos: p.huecos.map(adaptarHueco),
  campanas: p.campanas.map(adaptarCampana),
  whatsapp: { conectado: p.whatsapp.conectado, modo: p.whatsapp.modo },
  asesora: p.configuracion.asesora,
  fechaCorte: p.configuracion.fecha_corte,
  archivos: [],
  agendaSinHora: (p.agenda_sin_hora ?? []).map((d) => ({ ...d, profesional: d.profesional as Profesional })),
  sinHorario: (p.sin_horario ?? []) as Profesional[],
  agendaSinCitas: p.agenda_sin_citas ?? 0,
  agendaCubiertaHasta: p.agenda_cubierta_hasta ?? undefined,
  ultimaCarga: p.ultima_carga ? utc(p.ultima_carga) : undefined,
  cargaAutomatica: !!p.carga_automatica,
  fuenteAgenda: p.fuente_agenda ?? null,
  fuenteError: p.fuente_error ?? undefined,
  cuposOcupados: (p.cupos_ocupados ?? []).map(adaptarHueco),
});

interface ApiFuente {
  tipo: FuenteAgenda['tipo'];
  enlace: string;
  enlace_detalle: string;
  revisar_cada_min: number;
  ultima_revision: string | null;
  error: string | null;
}
const adaptarFuente = (f: ApiFuente): FuenteAgenda => ({
  tipo: f.tipo,
  enlace: f.enlace,
  enlaceDetalle: f.enlace_detalle,
  cadaMin: f.revisar_cada_min,
  ultimaRevision: f.ultima_revision ? utc(f.ultima_revision) : undefined,
  error: f.error ?? undefined,
});

const adaptarEquipo = (e: ApiEquipo): Equipo => ({
  horarios: Object.fromEntries(e.horarios.map((h) => [h.profesional, h.franjas.map((f) => ({ dia: f.dia_semana, inicio: f.inicio, fin: f.fin }))])) as Equipo['horarios'],
  pausas: e.pausas,
  ausencias: e.ausencias.map((a) => ({ id: String(a.id), userId: a.user_id, nombre: a.nombre, desde: a.desde, hasta: a.hasta, motivo: a.motivo })),
});

// ---------- endpoints ----------
const n = (id: string) => Number(id);
export type AccionCampana = 'pausar' | 'reanudar' | 'cancelar' | 'reintentar_fallidos';
export interface NuevaCampana {
  nombre: string;
  audiencia: string;
  plantilla: string;
  ritmoSeg: number;
  inicio: string;
  envios: { pacienteId: string; texto: string }[];
}

export const api = {
  panel: () => pedir<ApiPanel>('/panel').then(adaptarPanel),
  configurar: (cambios: { asesora?: string; fecha_corte?: string }) => patch('/configuracion', cambios),

  // equipo: horarios de especialistas, descansos de la clínica y vacaciones (solo gerencia escribe)
  equipo: () => pedir<ApiEquipo>('/equipo').then(adaptarEquipo),
  guardarHorario: (profesional: Profesional, franjas: Franja[]) =>
    pedir('/equipo/horarios', { method: 'PUT', body: JSON.stringify({ profesional, franjas: franjas.map((f) => ({ dia_semana: f.dia, inicio: f.inicio, fin: f.fin })) }) }),
  guardarPausas: (pausas: Pausa[]) => pedir('/equipo/pausas', { method: 'PUT', body: JSON.stringify(pausas) }),
  registrarAusencia: (a: { userId: string; desde: string; hasta: string; motivo: string }) =>
    post('/equipo/ausencias', { user_id: a.userId, desde: a.desde, hasta: a.hasta, motivo: a.motivo }),
  borrarAusencia: (id: string) => pedir<void>(`/equipo/ausencias/${n(id)}`, { method: 'DELETE' }),
  // horario y almuerzo deducidos de las citas cargadas (gerencia solo confirma)
  horarioSugerido: () =>
    pedir<{ horarios: ApiEquipo['horarios']; pausas: Pausa[]; citas_con_hora: number }>('/equipo/sugerido').then((s) => ({
      horarios: adaptarEquipo({ horarios: s.horarios, pausas: [], ausencias: [] }).horarios,
      pausas: s.pausas,
      citas: s.citas_con_hora,
    })),

  // pacientes y 3-7-15
  expediente: (id: string) => pedir<ApiPaciente>(`/pacientes/${n(id)}`).then(adaptarPaciente),
  contactar: (id: string, c: { resultado: Resultado; mensaje: string; motivo: Motivo; nota?: string }) =>
    post<ApiPaciente>(`/pacientes/${n(id)}/contactos`, c).then(adaptarPaciente),
  actualizar: (id: string, c: { celular?: string; profesional_principal?: string }) => patch<ApiPaciente>(`/pacientes/${n(id)}`, c).then(adaptarPaciente),
  nota: (id: string, texto: string) => post(`/pacientes/${n(id)}/notas`, { texto }),
  reactivar: (id: string) => post<ApiPaciente>(`/pacientes/${n(id)}/reactivar`, {}).then(adaptarPaciente),
  descartar: (id: string) => post<ApiPaciente>(`/pacientes/${n(id)}/descartar`, {}).then(adaptarPaciente),
  crearPaciente: (p: Paciente) =>
    post<ApiPaciente>('/pacientes', {
      nombre_completo: p.nombre,
      celular: p.telefono || undefined,
      email: p.email || undefined,
      apoderado: p.apoderado || undefined,
      caso_seguimiento: p.caso,
      perfil_comercial: p.segmento,
      profesional_principal: p.especialista,
      fecha_evento: p.fechaEvento,
      ultimo_comentario: p.tratamiento || undefined,
      valor_estimado_cop: p.valor || undefined,
    }).then(adaptarPaciente),

  // agenda libre
  crearCupo: (h: Hueco) => post<ApiHueco>('/agenda/huecos', { fecha: h.fecha, hora: h.hora, minutos: h.minutos, profesional: h.especialista }).then(adaptarHueco),
  borrarCupo: (id: string) => pedir<void>(`/agenda/huecos/${n(id)}`, { method: 'DELETE' }),
  ofrecer: (cupo: string, paciente: string) => post<{ hueco: ApiHueco }>(`/agenda/huecos/${n(cupo)}/ofrecer`, { numero_paciente: n(paciente) }).then((r) => adaptarHueco(r.hueco)),
  rechazar: (cupo: string, paciente: string) => post<ApiHueco>(`/agenda/huecos/${n(cupo)}/rechazar`, { numero_paciente: n(paciente) }).then(adaptarHueco),
  asignar: (cupo: string, paciente: string) => post<ApiHueco>(`/agenda/huecos/${n(cupo)}/asignar`, { numero_paciente: n(paciente) }).then(adaptarHueco),
  revertir: (cupo: string) => post<ApiHueco>(`/agenda/huecos/${n(cupo)}/revertir`).then(adaptarHueco),
  confirmar: (cupo: string) => post<ApiHueco>(`/agenda/huecos/${n(cupo)}/confirmar`).then(adaptarHueco),
  // recepción revisó en el software si el tiempo calculado sigue libre
  // libre: true = sigue libre · false = ya estaba ocupado · null = deshacer la marca
  verificarCupos: (ids: string[], libre: boolean | null) => post<ApiHueco[]>('/agenda/huecos/verificar', { ids: ids.map(n), libre }).then((r) => r.map(adaptarHueco)),
  asistencia: (cupo: string, asistencia: 'asistio' | 'no_asistio') => post<ApiHueco>(`/agenda/huecos/${n(cupo)}/asistencia`, { asistencia }).then(adaptarHueco),

  // campañas (el backend envía por WhatsApp; el token vive en su .env)
  // textos: el mensaje ya personalizado de cada paciente (el mismo de la vista previa)
  crearCampana: (c: NuevaCampana) =>
    post<ApiCampana>('/campanas', {
      nombre: c.nombre,
      audiencia: c.audiencia,
      plantilla: c.plantilla,
      ritmo_seg: c.ritmoSeg,
      inicio: c.inicio,
      pacientes_ids: c.envios.map((e) => n(e.pacienteId)),
      textos: Object.fromEntries(c.envios.map((e) => [n(e.pacienteId), e.texto])),
    }).then(adaptarCampana),
  enviarSiguiente: (id: string) => post<ApiCampana>(`/campanas/${n(id)}/ejecutar-lote`, { tamano_lote: 1 }).then(adaptarCampana),
  accionCampana: (id: string, accion: AccionCampana) => patch<ApiCampana>(`/campanas/${n(id)}/estado`, { accion }).then(adaptarCampana),
  respuesta: (id: string, envio: string, respondio: boolean) => patch<ApiCampana>(`/campanas/${n(id)}/envios/${n(envio)}`, { respondio }).then(adaptarCampana),
  borrarCampana: (id: string) => pedir<void>(`/campanas/${n(id)}`, { method: 'DELETE' }),

  // carga de los Excel del software (ETL del backend)
  subirExcel: (archivos: { historial: File; detalle?: File; arancel?: File; guiones?: File }) => {
    const f = new FormData();
    f.append('agenda_estados', archivos.historial);
    if (archivos.detalle) f.append('agenda_citas', archivos.detalle);
    if (archivos.arancel) f.append('arancel', archivos.arancel);
    if (archivos.guiones) f.append('guiones', archivos.guiones);
    return pedir<{ total_pacientes: number; total_citas: number }>('/ingesta/cargar-archivos', { method: 'POST', body: f });
  },
  // agenda en línea: enlace (lo conecta gerencia), base de datos o carpeta; se actualiza sola
  fuente: () => pedir<ApiFuente>('/ingesta/fuente').then(adaptarFuente),
  guardarFuente: (enlace: string, enlaceDetalle: string) =>
    pedir<ApiFuente>('/ingesta/fuente', { method: 'PUT', body: JSON.stringify({ enlace, enlace_detalle: enlaceDetalle }) }).then(adaptarFuente),
  actualizarFuente: () => post<ApiFuente>('/ingesta/fuente/actualizar').then(adaptarFuente),
  recargarExcel: () => post<{ total_pacientes: number; total_citas: number }>('/ingesta/cargar-desde-ruta'),
};
