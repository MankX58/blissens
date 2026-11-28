// Inicio de sesión del panel (Better Auth). Corre en Node aparte del backend FastAPI y comparte backend/blissens.db:
// FastAPI (../blissens-backend) valida la misma cookie en app/modules/auth/sesion_service.py.
//
//   npm run dev                                                     (desarrollo: Vite atiende /api/auth con este archivo)
//   npm run auth                                                    (producción: servidor aparte en :4000)
//   npx @better-auth/cli@1.4.21 migrate --config auth/auth.ts -y    (crea/actualiza user, session, account, verification)
//   npx tsx --env-file=.env auth/crear-admin.ts correo@dominio.com  (da de alta una cuenta de dirección)
//
// Sin registro público: dirección crea las cuentas desde la pantalla "Cuentas"; con Google solo entra
// quien ya tiene cuenta con ese correo (disableImplicitSignUp).
import { DatabaseSync } from 'node:sqlite';
import { Pool } from 'pg';
import { betterAuth } from 'better-auth';
import { admin } from 'better-auth/plugins';
import { ac, permisos } from '../src/lib/roles';

const google = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;
// Direcciones extra desde las que se puede entrar (p. ej. un túnel privado de Tailscale o Cloudflare),
// separadas por comas; admite comodines: https://*.trycloudflare.com. Vacío = solo BETTER_AUTH_URL.
export const origenesConfiables = (process.env.ORIGENES_CONFIABLES ?? '').split(',').map((o) => o.trim()).filter(Boolean);

// Base de las cuentas, compartida con FastAPI:
// - DATABASE_URL=postgres(ql)://… → PostgreSQL (p. ej. Neon, para desplegar en la nube)
// - sin DATABASE_URL → el SQLite local de siempre (espera hasta 5 s si FastAPI está escribiendo; modo WAL)
const urlBase = process.env.DATABASE_URL ?? '';
const enPostgres = /^postgres(ql)?(\+\w+)?:\/\//.test(urlBase);
const baseDeDatos = enPostgres
  ? new Pool({ connectionString: urlBase.replace(/^postgresql\+\w+:/, 'postgresql:'), max: 5 })
  : new DatabaseSync('backend/blissens.db', { timeout: 5000 });

export const auth = betterAuth({
  database: baseDeDatos,
  emailAndPassword: { enabled: true, disableSignUp: true },
  trustedOrigins: origenesConfiables,
  // especialistas: qué agenda es la suya ('Dra. Sara López' | 'Dr. Juan Manuel Olarte'); solo gerencia lo asigna
  user: { additionalFields: { profesional: { type: 'string', required: false, input: false } } },
  socialProviders: google
    ? { google: { clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET!, disableImplicitSignUp: true, prompt: 'select_account' } }
    : {},
  plugins: [admin({ ac, roles: permisos, defaultRole: 'auxiliar', adminRoles: ['direccion'] })],
});
