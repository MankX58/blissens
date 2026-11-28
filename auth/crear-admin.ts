// Da de alta (o asciende) una cuenta de dirección.
//   npx tsx --env-file=.env auth/crear-admin.ts correo@dominio.com ["Nombre"]
// Sin contraseña entra con Google usando ese correo. Para entrar con contraseña (p. ej. en un servidor
// sin Google configurado), pásala en ADMIN_CLAVE: así no queda en el historial de la terminal.
//   read -s ADMIN_CLAVE && ADMIN_CLAVE="$ADMIN_CLAVE" npx tsx --env-file=.env auth/crear-admin.ts correo@dominio.com
import { auth } from './auth';

const [email, nombre] = process.argv.slice(2);
if (!email?.includes('@')) throw new Error('Uso: npx tsx --env-file=.env auth/crear-admin.ts correo@dominio.com ["Nombre"]');
const clave = process.env.ADMIN_CLAVE;
if (clave && clave.length < 8) throw new Error('ADMIN_CLAVE debe tener al menos 8 caracteres');

const ctx = await auth.$context;
const u = await ctx.internalAdapter.findUserByEmail(email.toLowerCase());
if (u) {
  await ctx.internalAdapter.updateUser(u.user.id, { role: 'direccion', banned: false });
  if (clave) console.log('La cuenta ya existía: la contraseña no se cambió (gerencia la cambia desde «Equipo → Editar»).');
  console.log(`${email} ahora es de dirección`);
} else {
  await auth.api.createUser({ body: { email, password: clave || undefined, name: nombre ?? email.split('@')[0], role: 'direccion', data: { emailVerified: true } } });
  console.log(`Cuenta de dirección creada para ${email}${clave ? ' (con contraseña)' : ' (entra con Google)'}`);
}
