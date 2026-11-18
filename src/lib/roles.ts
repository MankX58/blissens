import type { Pantalla } from '../types';

export type Rol = 'auxiliar' | 'recepcion' | 'mercadeo' | 'direccion';

export const ROLES: Record<Rol, { nombre: string; color: string }> = {
  auxiliar: { nombre: 'Auxiliar administrativa', color: '#f472b6' },
  recepcion: { nombre: 'Recepción y agenda', color: '#93c5fd' },
  mercadeo: { nombre: 'Mercadeo y comercial', color: '#c4b5fd' },
  direccion: { nombre: 'Dirección y especialistas', color: '#86efac' },
};

export const ROL_DE: Record<Pantalla, Rol[]> = {
  hoy: ['auxiliar'],
  pacientes: ['auxiliar', 'direccion'],
  cargar: ['auxiliar'],
  agenda: ['recepcion'],
  campanas: ['mercadeo'],
  indicadores: ['direccion'],
};
