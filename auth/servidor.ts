import { createServer } from 'node:http';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth';

const PUERTO = Number(process.env.AUTH_PORT ?? 4000);
createServer(toNodeHandler(auth)).listen(PUERTO, () => console.log(`Better Auth en http://localhost:${PUERTO}/api/auth`));
