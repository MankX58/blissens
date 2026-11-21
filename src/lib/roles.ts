import { createAccessControl } from 'better-auth/plugins/access';
import { adminAc, defaultStatements } from 'better-auth/plugins/admin/access';
import type { Pantalla } from '../types';

export type Rol = 'auxiliar' | 'recepcion' | 'mercadeo' | 'direccion';

export const ROLES: Record<Rol, { nombre: string; color: string }> = {
  auxiliar: { nombre: 'Auxiliar administrativa', color: '#f472b6' },
  recepcion: { nombre: 'Recepción y agenda', color: '#93c5fd' },
  mercadeo: { nombre: 'Campañas de reactivación', color: '#c4b5fd' }, // id interno 'mercadeo' (guardado en user.role)
  direccion: { nombre: 'Dirección y especialistas', color: '#86efac' },
};

export const ROL_DE: Record<Pantalla, Rol[]> = {
  hoy: ['auxiliar'],
  pacientes: ['auxiliar', 'direccion'],
  cargar: ['auxiliar'],
  agenda: ['recepcion'],
  campanas: ['mercadeo'],
  indicadores: ['direccion'],
  cuentas: ['direccion'],
};

// dirección administra el panel: ve todas las pantallas y gestiona las cuentas
export const puedeVer = (rol: Rol, p: Pantalla) => rol === 'direccion' || ROL_DE[p].includes(rol);

// permisos de Better Auth (los usan auth/auth.ts y el cliente): solo dirección administra cuentas
export const ac = createAccessControl(defaultStatements);
export const permisos: Record<Rol, ReturnType<typeof ac.newRole>> = {
  direccion: ac.newRole(adminAc.statements),
  auxiliar: ac.newRole({}),
  recepcion: ac.newRole({}),
  mercadeo: ac.newRole({}),
};
