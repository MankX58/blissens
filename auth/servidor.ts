import { createServer } from 'node:http';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth';

// Render y similares asignan el puerto en PORT; en local se usa AUTH_PORT o 4000
const PUERTO = Number(process.env.PORT ?? process.env.AUTH_PORT ?? 4000);
createServer(toNodeHandler(auth)).listen(PUERTO, '0.0.0.0', () => console.log(`Better Auth en http://localhost:${PUERTO}/api/auth`));
