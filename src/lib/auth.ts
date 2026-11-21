import { createAuthClient } from 'better-auth/react';
import { adminClient } from 'better-auth/client/plugins';
import { ROLES, ac, permisos, type Rol } from './roles';

// mismo origen: Vite (y el proxy de producción) pasan /api/auth al servidor de auth/servidor.ts
export const authClient = createAuthClient({ plugins: [adminClient({ ac, roles: permisos })] });

export const esRol = (r: unknown): r is Rol => typeof r === 'string' && r in ROLES;

// errores que Better Auth devuelve en ?error= al volver de Google
export const ERROR_GOOGLE: Record<string, string> = {
  signup_disabled: 'Ese correo de Google no tiene cuenta en el panel. Pídele a dirección que te la cree.',
  account_not_linked: 'No se pudo vincular Google con tu cuenta. Entra con tu contraseña o pídele ayuda a dirección.',
  banned: 'Tu cuenta está desactivada. Habla con dirección.',
};
