import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      // En desarrollo Vite atiende /api/auth con Better Auth (auth/auth.ts): basta `npm run dev`.
      // En producción corre aparte con `npm run auth`.
      {
        name: 'better-auth-dev',
        apply: 'serve',
        configureServer(server) {
          for (const [k, v] of Object.entries(loadEnv(mode, __dirname, ''))) process.env[k] ??= v;
          server.middlewares.use(async (req, res, next) => {
            if (!req.url?.startsWith('/api/auth')) return next();
            try {
              // si el 3000 está ocupado Vite usa otro puerto: Better Auth debe usar ese mismo origen
              // (si no, responde "Invalid origin"); Google necesita ese URI de redirección registrado
              const local = server.resolvedUrls?.local[0];
              if (local) process.env.BETTER_AUTH_URL = new URL(local).origin;
              const [{auth}, {toNodeHandler}] = await Promise.all([server.ssrLoadModule('/auth/auth.ts'), import('better-auth/node')]);
              await toNodeHandler(auth)(req, res);
            } catch (e) {
              next(e);
            }
          });
        },
      },
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // mismo origen para las cookies: /api (menos /api/auth, que atiende el plugin de arriba) → FastAPI
      proxy: {
        '/api': `http://localhost:${process.env.API_PORT ?? 8000}`,
      },
      // túnel privado (ORIGENES_CONFIABLES en .env): Vite solo atiende esos dominios además de localhost
      allowedHosts: (loadEnv(mode, __dirname, '').ORIGENES_CONFIABLES ?? '')
        .split(',')
        .map((o) => o.trim().replace(/^https?:\/\//, '').replace(/^\*\./, '.').replace(/[:/].*$/, ''))
        .filter(Boolean),
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
