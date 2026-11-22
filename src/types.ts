// Caso por el que el paciente aparece en la lista
export type Caso = 'cancelo' | 'no_asistio' | 'diagnostico' | 'pausa' | 'limpieza';
export type Segmento = 'local' | 'internacional' | 'deportista';
// activo = tiene cita confirmada (segmento 4 del SRS): no entra a la bandeja
export type Estado = 'pendiente' | 'recuperado' | 'descartado' | 'agotado' | 'activo';
export type Resultado = 'agendo' | 'sin_respuesta' | 'lo_pensara' | 'no_interesa';
export type Motivo = 'costos' | 'agenda' | 'viaje' | 'miedo' | 'salud' | 'otro' | 'sin_dato';
export type Grupo = 1 | 2 | 3 | 4; // segmentos del SRS
export type Antiguedad = 'Nuevo' | 'Antiguo';
export type NivelRiesgo = 'Bajo' | 'Medio' | 'Alto';
export type Profesional = 'Dra. Sara López' | 'Dr. Juan Manuel Olarte';

// Una cita real de la agenda exportada del software
export interface Cita {
  id: number; // # Cita
  paciente: number; // # Paciente
  fecha: string; // YYYY-MM-DD
  hora?: string; // HH:MM (solo viene en el archivo de detalle)
  estado: string; // texto original del software
  tipo: 'Diagnóstico' | 'Tratamiento';
  profesional: Profesional;
  comentario?: string;
  orden: number; // posición en el Excel: en un mismo día, la primera fila es la más reciente
}

export interface Contacto {
  fecha: string;
  paso: 3 | 7 | 15;
  resultado: Resultado;
  mensaje: string;
  nota?: string;
  huecoId?: string;
}

export interface Nota {
  fecha: string;
  texto: string;
}

export interface Ciclo {
  caso: Caso;
  fechaEvento: string;
  contactos: Contacto[];
  cierre: Estado;
  motivo: Motivo;
}

export interface Paciente {
  id: string;
  idPaciente: string; // "#36"
  nombre: string;
  telefono: string; // +57... o vacío
  email: string;
  apoderado: string;
  ciudad: string;
  segmento: Segmento;
  antiguedad: Antiguedad;
  motivoVip?: string; // por qué es VIP (lo decide el backend, RN-08)
  etiquetas: string[]; // VIP, Valoración virtual, Rehabilitación, Alineadores, Convenio FLAIRES
  grupo: Grupo;
  fallosHistoricos: number; // todas las citas sin cumplir del historial
  fallosSeguidos: number; // sin cumplir desde la última vez que asistió (define el riesgo)
  ultimaAtendida?: string;
  nivelRiesgo: NivelRiesgo;
  caso: Caso;
  fechaEvento: string; // desde cuándo corre la regla 3-7-15
  ultimaCita?: { fecha: string; hora?: string; estado: string; tipo: string };
  tratamiento: string;
  especialista: Profesional;
  valor: number; // COP estimado con el arancel
  valorReferencia?: { acciones: string[]; fuente: 'comentario' | 'tipo de cita' }; // de dónde sale el valor
  motivo: Motivo;
  estado: Estado;
  contactos: Contacto[];
  recuperadoEl?: string;
  notas: Nota[];
  ciclos: Ciclo[];
  origen: 'excel' | 'manual';
  creadoEl: string;
}

export interface Hueco {
  id: string;
  fecha: string;
  hora: string;
  minutos: number;
  especialista: Profesional;
  ocupadoPor?: string;
  asignadoEl?: string;
  estadoPrevio?: Estado;
  ofertas: { pacienteId: string; fecha: string; rechazo?: boolean }[]; // a quién se le ofreció y si dijo que no
  confirmadoEl?: string; // confirmación 24 h antes
  asistencia?: 'asistio' | 'no_asistio';
}

export type EstadoEnvio = 'pendiente' | 'enviado' | 'respondio' | 'fallo' | 'omitido';

export interface Envio {
  id?: string; // id del backend (para marcar la respuesta)
  pacienteId: string;
  nombre: string;
  telefono: string;
  texto: string;
  estado: EstadoEnvio;
  fecha?: string;
  error?: string;
}

export interface Campana {
  id: string;
  nombre: string;
  audiencia: string;
  plantilla: string;
  creadaEl: string;
  inicio: string;
  ritmoSeg: number;
  canal: 'api' | 'simulado';
  estado: 'programada' | 'enviando' | 'pausada' | 'completada' | 'cancelada';
  envios: Envio[];
}


export interface Datos {
  pacientes: Paciente[];
  citas: Cita[];
  huecos: Hueco[];
  campanas: Campana[];
  whatsapp: { conectado: boolean; modo: string }; // estado del canal; el token vive en el .env del backend
  asesora: string; // quien firma los guiones: [ASESOR/A]
  fechaCorte: string; // fecha de trabajo: por defecto, el cierre de la agenda cargada
  archivos: string[];
}

export type Pantalla = 'inicio' | 'hoy' | 'pacientes' | 'agenda' | 'campanas' | 'indicadores' | 'cargar' | 'cuentas';
