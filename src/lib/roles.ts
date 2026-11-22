import { createAccessControl } from 'better-auth/plugins/access';
import { adminAc, defaultStatements } from 'better-auth/plugins/admin/access';
import type { Pantalla } from '../types';

// El id es el valor guardado en user.role (Better Auth) y el que usa FastAPI en requiere_rol(...)
// Tres roles, como el equipo real: recepción (agenda + WhatsApp), especialistas y gerencia.
// Las campañas NO son un rol aparte: continúan el 3-7-15 y las envía la misma persona que hace el seguimiento.
export type Rol = 'auxiliar' | 'especialista' | 'direccion';

export interface DefRol {
  nombre: string;
  color: string;
  quien: string; // quién lo ejerce en la clínica
  proposito: string;
  hace: string[];
  ve: string[];
  noVe: string[];
}

// Definición de cada rol a partir del proceso real de la clínica (Descripción del proceso actual + Acta del proyecto)
export const ROLES: Record<Rol, DefRol> = {
  auxiliar: {
    nombre: 'Recepción y seguimiento',
    color: '#f472b6',
    quien: 'Auxiliar administrativa / recepción',
    proposito: 'Que ningún paciente quede sin reagendar y que ningún cupo quede vacío.',
    hace: [
      'Contacta a los pacientes con la regla 3-7-15',
      'Reprograma cancelaciones e inasistencias y registra el motivo',
      'Llena los cupos libres y confirma 24 h antes',
      'Envía campañas a quien no respondió el 3-7-15 y a los inactivos',
      'Carga la agenda exportada del software',
    ],
    ve: ['La lista del día, la agenda libre y las campañas', 'Expediente y contacto de todos los pacientes', 'El valor estimado, para priorizar'],
    noVe: ['Indicadores de gerencia', 'Cuentas del equipo'],
  },
  especialista: {
    nombre: 'Especialista',
    color: '#93c5fd',
    quien: 'Dra. Sara López · Dr. Juan Manuel Olarte',
    proposito: 'Que sus pacientes terminen el tratamiento y su sillón no quede vacío.',
    hace: ['Revisa sus tratamientos en pausa y diagnósticos sin iniciar', 'Deja notas para orientar el contacto de recepción', 'Ve su tiempo libre, calculado de su horario y sus citas'],
    ve: ['Solo sus pacientes y su expediente', 'Su agenda libre y a quién se le ofreció cada cupo'],
    noVe: ['Contactar o agendar: lo hace recepción', 'Pacientes de otros especialistas', 'Campañas, indicadores y cuentas'],
  },
  direccion: {
    nombre: 'Gerencia',
    color: '#86efac',
    quien: 'Eme y Eme Group',
    proposito: 'Decidir con datos: dónde se pierde la agenda, cuánto dinero está detenido y cómo avanza cada área.',
    hace: [
      'Sigue los indicadores de recuperación y fricción',
      'Decide a qué segmentos apuntar las campañas y revisa su respuesta',
      'Define horarios, descansos y vacaciones: de ahí sale la agenda libre',
      'Crea y edita las cuentas y asigna roles',
    ],
    ve: ['Todo el panel, incluidas las secciones de cada rol'],
    noVe: [],
  },
};

// secciones por rol (gerencia entra a todas). "inicio" es el resumen propio de cada rol.
export const ROL_DE: Record<Pantalla, Rol[]> = {
  inicio: ['auxiliar', 'especialista', 'direccion'],
  hoy: ['auxiliar'],
  pacientes: ['auxiliar', 'especialista'],
  agenda: ['auxiliar', 'especialista'],
  cargar: ['auxiliar'],
  campanas: ['auxiliar'],
  indicadores: ['direccion'],
  cuentas: ['direccion'],
};

export const puedeVer = (rol: Rol, p: Pantalla) => rol === 'direccion' || ROL_DE[p].includes(rol);

// permisos de Better Auth (los usan auth/auth.ts y el cliente): solo gerencia administra cuentas
export const ac = createAccessControl(defaultStatements);
export const permisos: Record<Rol, ReturnType<typeof ac.newRole>> = {
  direccion: ac.newRole(adminAc.statements),
  auxiliar: ac.newRole({}),
  especialista: ac.newRole({}),
};
