// Caso por el que el paciente aparece en la lista
export type Caso = 'cancelo' | 'no_asistio' | 'diagnostico' | 'limpieza';
export type Segmento = 'local' | 'internacional' | 'deportista';
export type Estado = 'pendiente' | 'recuperado' | 'descartado' | 'agotado';
export type Resultado = 'agendo' | 'sin_respuesta' | 'lo_pensara' | 'no_interesa';
export type Motivo = 'costos' | 'agenda' | 'viaje' | 'miedo' | 'salud' | 'otro' | 'sin_dato';

export interface Contacto {
  fecha: string; // YYYY-MM-DD
  paso: 3 | 7 | 15;
  resultado: Resultado;
  mensaje: string;
  nota?: string;
  huecoId?: string; // si el "agendó" vino de asignarle un espacio de la agenda abierta
}

export interface Nota {
  fecha: string;
  texto: string;
}

// Proceso 3-7-15 ya cerrado (el paciente volvió a caer en la lista después)
export interface Ciclo {
  caso: Caso;
  fechaEvento: string;
  contactos: Contacto[];
  cierre: Estado;
  motivo: Motivo;
}

export interface Paciente {
  id: string;
  nombre: string;
  telefono: string;
  ciudad: string;
  segmento: Segmento;
  caso: Caso;
  fechaEvento: string; // día de la cancelación, inasistencia, diagnóstico o vencimiento del control
  tratamiento: string;
  especialista: string;
  valor: number; // COP
  motivo: Motivo;
  estado: Estado;
  contactos: Contacto[];
  recuperadoEl?: string;
  notas: Nota[];
  ciclos: Ciclo[];
  origen: 'demo' | 'excel' | 'manual';
  creadoEl: string;
}

export interface Hueco {
  id: string;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:MM
  minutos: number;
  especialista: string;
  ocupadoPor?: string; // id paciente
  asignadoEl?: string;
  estadoPrevio?: Estado; // para poder revertir la asignación
  ofertas: { pacienteId: string; fecha: string }[];
  asistencia?: 'asistio' | 'no_asistio';
}

export type EstadoEnvio = 'pendiente' | 'enviado' | 'respondio' | 'fallo' | 'omitido';

export interface Envio {
  pacienteId: string;
  nombre: string;
  telefono: string;
  texto: string;
  estado: EstadoEnvio;
  fecha?: string; // ISO con hora
  error?: string;
}

export interface Campana {
  id: string;
  nombre: string;
  audiencia: string;
  plantilla: string;
  creadaEl: string; // ISO
  inicio: string; // ISO: cuándo empieza a enviar
  ritmoSeg: number; // pausa entre mensajes
  canal: 'api' | 'simulado';
  estado: 'programada' | 'enviando' | 'pausada' | 'completada' | 'cancelada';
  envios: Envio[];
}

export interface ConfigWA {
  token: string;
  phoneId: string;
  plantilla: string; // nombre de plantilla aprobada en Meta (opcional)
  idioma: string;
}

export interface Datos {
  pacientes: Paciente[];
  huecos: Hueco[];
  campanas: Campana[];
  config: ConfigWA;
}

export type Pantalla = 'hoy' | 'pacientes' | 'agenda' | 'campanas' | 'indicadores' | 'cargar';
