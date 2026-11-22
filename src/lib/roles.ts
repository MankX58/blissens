import { createAccessControl } from 'better-auth/plugins/access';
import { adminAc, defaultStatements } from 'better-auth/plugins/admin/access';
import type { Pantalla } from '../types';

// El id es el valor guardado en user.role (Better Auth) y el que usa FastAPI en requiere_rol(...)
export type Rol = 'auxiliar' | 'especialista' | 'mercadeo' | 'direccion';

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
    hace: ['Contacta a los pacientes con la regla 3-7-15', 'Reprograma cancelaciones e inasistencias y registra el motivo', 'Llena los cupos libres y confirma 24 h antes', 'Carga la agenda exportada del software'],
    ve: ['La lista del día y la agenda libre', 'Expediente y contacto de todos los pacientes', 'El valor estimado, para priorizar'],
    noVe: ['Indicadores de gerencia', 'Campañas masivas', 'Cuentas del equipo'],
  },
  especialista: {
    nombre: 'Especialista',
    color: '#93c5fd',
    quien: 'Dra. Sara López · Dr. Juan Manuel Olarte',
    proposito: 'Que sus pacientes terminen el tratamiento y su sillón no quede vacío.',
    hace: ['Revisa sus tratamientos en pausa y diagnósticos sin iniciar', 'Deja notas para orientar el contacto de recepción', 'Sigue los cupos libres de su agenda'],
    ve: ['Solo sus pacientes y su expediente', 'Solo los cupos de su agenda'],
    noVe: ['Pacientes de otros especialistas', 'Campañas e indicadores de la clínica', 'Cuentas del equipo'],
  },
  mercadeo: {
    nombre: 'Campañas de reactivación',
    color: '#c4b5fd',
    quien: 'Comunicación y reactivación',
    proposito: 'Recuperar a quien el seguimiento diario no alcanzó: inactivos, convenios y segmentos de alto valor.',
    hace: ['Arma campañas de WhatsApp por segmento', 'Personaliza los mensajes con los guiones oficiales', 'Mide quién responde y vuelve'],
    ve: ['Segmentos y cuántos pacientes tiene cada uno', 'Nombre y celular de la audiencia', 'Resultados de sus campañas'],
    noVe: ['Expedientes clínicos y notas internas', 'La agenda y sus cupos', 'Indicadores de gerencia y cuentas'],
  },
  direccion: {
    nombre: 'Gerencia',
    color: '#86efac',
    quien: 'Eme y Eme Group',
    proposito: 'Decidir con datos: dónde se pierde la agenda, cuánto dinero está detenido y cómo avanza cada área.',
    hace: ['Sigue los indicadores de recuperación y fricción', 'Revisa el avance de cada área', 'Crea las cuentas y asigna roles'],
    ve: ['Todo el panel, incluidas las secciones de cada rol'],
    noVe: [],
  },
};

// secciones por rol (gerencia entra a todas). "inicio" es el resumen propio de cada rol.
export const ROL_DE: Record<Pantalla, Rol[]> = {
  inicio: ['auxiliar', 'especialista', 'mercadeo', 'direccion'],
  hoy: ['auxiliar'],
  pacientes: ['auxiliar', 'especialista'],
  agenda: ['auxiliar', 'especialista'],
  cargar: ['auxiliar'],
  campanas: ['mercadeo'],
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
  mercadeo: ac.newRole({}),
};
