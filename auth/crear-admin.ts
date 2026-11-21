// Da de alta (o asciende) una cuenta de dirección. Sin contraseña: entra con Google usando ese correo.
//   npx tsx --env-file=.env auth/crear-admin.ts correo@dominio.com ["Nombre"]
import { auth } from './auth';

const [email, nombre] = process.argv.slice(2);
if (!email?.includes('@')) throw new Error('Uso: npx tsx --env-file=.env auth/crear-admin.ts correo@dominio.com ["Nombre"]');

const ctx = await auth.$context;
const u = await ctx.internalAdapter.findUserByEmail(email.toLowerCase());
if (u) {
  await ctx.internalAdapter.updateUser(u.user.id, { role: 'direccion', banned: false });
  console.log(`${email} ahora es de dirección`);
} else {
  await auth.api.createUser({ body: { email, name: nombre ?? email.split('@')[0], role: 'direccion', data: { emailVerified: true } } });
  console.log(`Cuenta de dirección creada para ${email}`);
}
