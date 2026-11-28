# Poner Blissens en línea

## La forma más simple y privada (recomendada)

**Los datos nunca salen de la clínica.** La app sigue corriendo en un computador de la clínica y el equipo entra desde sus celulares o computadores por una **red privada cifrada** ([Tailscale](https://tailscale.com), gratis). La página no queda publicada en internet: solo los equipos que agregues pueden siquiera verla, y además cada persona entra con su cuenta del panel.

| | Esta opción | Servidor en la nube (más abajo) |
|---|---|---|
| Dónde quedan los datos de pacientes | En el computador de la clínica | En un servidor de un proveedor |
| Quién puede abrir la página | Solo los equipos agregados a la red de la clínica | Cualquiera con la URL (protegida por el inicio de sesión) |
| Costo | Gratis | ~5 USD/mes + dominio |
| Dificultad | 15 minutos, sin servidores | Linux, dominio, HTTPS, servicios |
| Requisito | Ese computador encendido en horario de trabajo | — |

### Paso a paso

**1. En el computador de la clínica**

1. Instala Tailscale: [tailscale.com/download](https://tailscale.com/download) e inicia sesión con una cuenta **de la clínica** (Google o Microsoft).
2. En [login.tailscale.com/admin/dns](https://login.tailscale.com/admin/dns) activa **MagicDNS** y **HTTPS Certificates**.
3. Arranca la app como siempre, en dos terminales:

   ```powershell
   npm run api
   ```

   ```powershell
   npm run dev
   ```

4. Publícala solo dentro de la red privada:

   ```powershell
   tailscale serve --bg 3000
   ```

   Te muestra una dirección como `https://pc-clinica.tu-red.ts.net`.
5. Agrega esa dirección al `.env` del panel y reinicia `npm run dev`:

   ```ini
   ORIGENES_CONFIABLES=https://pc-clinica.tu-red.ts.net
   ```

**2. En el celular o computador de cada persona del equipo**

1. Instala Tailscale y entra con **la misma cuenta de la clínica** (o invítala desde [login.tailscale.com/admin/users](https://login.tailscale.com/admin/users)).
2. Abre `https://pc-clinica.tu-red.ts.net` y entra con su cuenta del panel.

**3. Cuentas del equipo**

Gerencia las crea en **Equipo → Nueva cuenta**, con contraseña (el inicio con Google no funciona por esta dirección privada).

### Para que funcione todos los días

- Deja el computador encendido y sin suspenderse en horario de trabajo.
- Si se reinicia, vuelve a correr `npm run api` y `npm run dev` (Tailscale y `serve --bg` arrancan solos).
- **Copia de seguridad**: copia `backend/blissens.db` a un disco externo o a la nube de la clínica una vez por semana (con la app detenida o fuera de horario).

### Solo para una demostración rápida

Si necesitas mostrarlo un momento a alguien sin instalarle nada (con **datos anonimizados** y con el visto bueno de la empresa, como pide el reto):

```powershell
winget install Cloudflare.cloudflared
```

```powershell
cloudflared tunnel --url http://localhost:3000
```

Te da una dirección temporal `https://algo-aleatorio.trycloudflare.com`. Agrega `ORIGENES_CONFIABLES=https://*.trycloudflare.com` al `.env`, reinicia `npm run dev`, y **cierra el túnel con Ctrl+C al terminar**: esa dirección es pública mientras esté abierta (solo la protege el inicio de sesión).

---

## Opción avanzada: servidor propio en la nube

Para cuando la empresa apruebe tener los datos en un servidor y quiera el panel disponible sin depender de un computador encendido.

### Antes de empezar: los datos

El reto indica que los datos se usan **solo en un entorno de prueba académico**, que **no se divulgan datos de pacientes ni cifras reales** y que **la empresa revisa antes cualquier demostración pública**. Por eso:

- Despliega con **datos anonimizados** (nombres, celulares y correos ficticios) mientras la empresa no apruebe usar los reales.
- No subas `backend/blissens.db` ni la carpeta `datos/` a GitHub (ya están en `.gitignore`).
- El panel no tiene registro público: solo entra quien gerencia da de alta. Aun así, comparte la URL solo con quien deba verla.

### Cómo queda

```
                  https://panel.tu-dominio.com
                               │
                         Caddy (HTTPS)
          ┌────────────────────┼─────────────────────┐
     /api/auth/*            /api/*                 todo lo demás
          │                    │                       │
  Better Auth (Node)     FastAPI (Python)        dist/ (React)
     :4000                  :8000                  archivos
          └──── backend/blissens.db (SQLite) ────┘
```

Better Auth y FastAPI **comparten el mismo archivo SQLite**, así que van en **un solo servidor**. Todo sale por el mismo dominio, así las cookies de sesión funcionan sin configurar CORS.

### 1. El servidor

- Un VPS con **Ubuntu 24.04**, 1 vCPU y 1–2 GB de RAM basta (DigitalOcean, Hetzner, AWS Lightsail, o el nivel gratuito de Oracle Cloud). Cuesta unos 5 USD al mes.
- Un dominio o subdominio, p. ej. `panel.tu-dominio.com`, con un **registro A** apuntando a la IP del servidor.

Conéctate por SSH y prepara el sistema:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git python3.12-venv sqlite3 debian-keyring debian-archive-keyring apt-transport-https curl
# Node 22 (Better Auth usa node:sqlite, que necesita Node 22.5 o más)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
# Caddy (HTTPS automático con Let's Encrypt)
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
# Cortafuegos: solo SSH y web
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw --force enable
# Usuario sin privilegios para correr la app
sudo useradd --system --create-home --home-dir /srv/blissens --shell /bin/bash blissens
```

### 2. El código

```bash
sudo -iu blissens
git clone https://github.com/MankX58/blissens.git app
git clone -b dev https://github.com/emmanuelsegurou/blissens-backend.git backend-api   # la rama con el trabajo actual
mkdir -p datos            # aquí van los 4 Excel (anonimizados)
```

Antes, en tu computador, confirma y sube (`git push`) los cambios de los dos repositorios: el servidor solo ve lo que está en GitHub.

Sube los Excel desde tu computador (desde tu PowerShell, no en el servidor):

```powershell
scp "Agenda citas y estados .xlsx" "Agenda y citas .xlsx" "Guiones_Blissens_.xlsx" "Arancel precios.xlsx" usuario@IP:/tmp/
```

y en el servidor: `sudo mv /tmp/*.xlsx /srv/blissens/datos/ && sudo chown blissens: /srv/blissens/datos/*`.

### 3. Variables de entorno

Genera **un** secreto y úsalo en los dos `.env`:

```bash
openssl rand -base64 32
```

`/srv/blissens/app/.env` (panel y Better Auth):

```ini
BETTER_AUTH_SECRET=<el secreto>
BETTER_AUTH_URL=https://panel.tu-dominio.com
# opcional, para entrar con Google:
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

`/srv/blissens/backend-api/.env` (FastAPI):

```ini
DATABASE_URL=sqlite:////srv/blissens/app/backend/blissens.db
BETTER_AUTH_SECRET=<el mismo secreto>
AUTH_HABILITADA=true
CORS_ORIGENES=["https://panel.tu-dominio.com"]
RUTA_DATOS_EXCEL=/srv/blissens/datos
# vacío = la fecha de hoy; para la demo con la agenda de 2026 deja 2026-11-12
FECHA_CORTE=2026-11-12
# la agenda se carga sola cuando llega un Excel nuevo a la carpeta (o conecta un enlace en línea desde el panel)
CARGA_AUTOMATICA=true
WHATSAPP_MODO=simulacion
```

Protege los archivos: `chmod 600 /srv/blissens/app/.env /srv/blissens/backend-api/.env`.

### 4. Instalar y preparar la base de datos

```bash
# panel
cd /srv/blissens/app
npm ci
npm run build                                               # genera dist/
mkdir -p backend
npx @better-auth/cli@1.4.21 migrate --config auth/auth.ts -y   # tablas de cuentas y sesiones

# backend
cd /srv/blissens/backend-api
python3.12 -m venv .venv
.venv/bin/pip install -e .
.venv/bin/python -c "from app.core.base_de_datos import inicializar_bd; inicializar_bd()"   # resto de tablas

# primera cuenta de gerencia (con contraseña; sin ADMIN_CLAVE entra solo con Google)
cd /srv/blissens/app
read -s ADMIN_CLAVE && ADMIN_CLAVE="$ADMIN_CLAVE" npx tsx --env-file=.env auth/crear-admin.ts tu-correo@dominio.com "Tu nombre"
exit   # vuelve a tu usuario con sudo
```

### 5. Servicios (arrancan solos y se reinician si fallan)

`/etc/systemd/system/blissens-auth.service`:

```ini
[Unit]
Description=Blissens · inicio de sesión (Better Auth)
After=network.target

[Service]
User=blissens
WorkingDirectory=/srv/blissens/app
ExecStart=/usr/bin/npm run auth
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

`/etc/systemd/system/blissens-api.service`:

```ini
[Unit]
Description=Blissens · API (FastAPI)
After=network.target

[Service]
User=blissens
WorkingDirectory=/srv/blissens/backend-api
# un solo proceso: la agenda libre y la carga automática usan un candado en memoria
ExecStart=/srv/blissens/backend-api/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now blissens-auth blissens-api
sudo systemctl status blissens-auth blissens-api --no-pager
```

### 6. HTTPS y rutas (Caddy)

`/etc/caddy/Caddyfile`:

```
panel.tu-dominio.com {
	encode gzip
	handle /api/auth/* {
		reverse_proxy 127.0.0.1:4000
	}
	handle /api/* {
		reverse_proxy 127.0.0.1:8000
	}
	handle {
		root * /srv/blissens/app/dist
		try_files {path} /index.html
		file_server
	}
}
```

```bash
sudo systemctl reload caddy
```

Caddy saca el certificado HTTPS solo (el registro A del dominio ya debe apuntar al servidor).

### 7. Primer uso

1. Abre `https://panel.tu-dominio.com` y entra con la cuenta de gerencia.
2. **Cargar agenda**: sube los Excel (o, con `CARGA_AUTOMATICA=true`, ya se cargaron de `/srv/blissens/datos`). También puedes **conectar un archivo en línea** (Google Sheets, Drive, OneDrive) para que se actualice solo.
3. **Equipo**: crea las cuentas, define horarios y descansos.

### Google (opcional)

En [Google Cloud → Credenciales](https://console.cloud.google.com/apis/credentials), en tu cliente OAuth agrega:

- Origen autorizado: `https://panel.tu-dominio.com`
- URI de redirección: `https://panel.tu-dominio.com/api/auth/callback/google`

Pon `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en `/srv/blissens/app/.env` y reinicia: `sudo systemctl restart blissens-auth`.

### Copias de seguridad

```bash
sudo -iu blissens mkdir -p /srv/blissens/copias
sudo crontab -u blissens -e
```

y agrega (copia diaria a las 2 a. m., conserva 14 días):

```
0 2 * * * sqlite3 /srv/blissens/app/backend/blissens.db ".backup /srv/blissens/copias/blissens-$(date +\%F).db" && find /srv/blissens/copias -name '*.db' -mtime +14 -delete
```

Descárgalas de vez en cuando a otro lugar: si el servidor se pierde, las copias también.

### Actualizar a una versión nueva

```bash
sudo -iu blissens
cd ~/app && git pull && npm ci && npm run build
cd ~/backend-api && git pull && .venv/bin/pip install -e .
exit
sudo systemctl restart blissens-auth blissens-api
```

Las tablas nuevas o columnas nuevas del backend se crean solas al arrancar. Si Better Auth agrega campos, repite el `migrate` del paso 4.

### Si algo falla

| Síntoma | Revisa |
|---|---|
| La página carga pero no deja entrar («Invalid origin») | `BETTER_AUTH_URL` debe ser exactamente `https://panel.tu-dominio.com` |
| Entra, pero el panel dice que no hay sesión (401) | El mismo `BETTER_AUTH_SECRET` en los dos `.env` y `AUTH_HABILITADA=true` |
| «El servidor de datos no responde» (502) | `sudo journalctl -u blissens-api -n 50` |
| Errores de inicio de sesión | `sudo journalctl -u blissens-auth -n 50` |
| Sin HTTPS | El registro A apunta al servidor y los puertos 80/443 están abiertos: `sudo journalctl -u caddy -n 50` |

---

## Gratis en la nube: Vercel + Render + Neon

```
https://TU-APP.vercel.app                 ← Vercel: el panel (React compilado)
   /api/auth/*  → Render «blissens-auth»  (Node: cuentas, Better Auth)
   /api/*       → Render «blissens-api»   (Python: FastAPI)
                         └── los dos usan la misma base PostgreSQL en Neon
```

Vercel reenvía `/api` a Render (`vercel.json`), así todo queda en **un solo dominio** y la cookie de sesión funciona sin CORS.
Los planes gratis de Render **se duermen tras ~15 min sin uso**: la primera visita tarda 30–60 s. Ábrelo un rato antes de una demo.
**Usa datos anonimizados**: la base queda en servidores de terceros.

### 0. La cadena de conexión de Neon

En Neon → *Connection details* copia la cadena (con `?sslmode=require`). Se usa de dos formas:

| Dónde | Formato |
|---|---|
| Cuentas (Node) y la migración | `postgresql://USUARIO:CLAVE@HOST/neondb?sslmode=require` |
| Backend (FastAPI) | `postgresql+psycopg://USUARIO:CLAVE@HOST/neondb?sslmode=require` |

### 1. Backend listo para PostgreSQL

Ya están hechos en la copia local del backend (falta confirmarlos y subirlos a `dev`):

- `pyproject.toml`: driver `psycopg[binary]`.
- `app/modules/auth/sesion_service.py`: las fechas de sesión se leen igual si vienen como texto (SQLite) o como fecha (PostgreSQL).
- `app/core/base_de_datos.py`: en PostgreSQL el backend **no crea** las tablas de cuentas (`user`, `session`, `account`, `verification`); esas las crea Better Auth en el paso 2. Si arranca sin ellas, se detiene con un mensaje que dice qué correr.
- `app/modules/equipo/tiempo_libre.py`: cupos para 37 días.

### 2. Crear las tablas de cuentas en Neon (una vez, desde tu computador)

**Antes** de arrancar el backend en Render (sin estas tablas, el backend no arranca y lo avisa en los logs):

```powershell
$env:DATABASE_URL="postgresql://USUARIO:CLAVE@HOST/neondb?sslmode=require"
```

```powershell
npx @better-auth/cli@1.4.21 migrate --config auth/auth.ts -y
```

Y la cuenta de gerencia (escribe la clave cuando la pida; no queda en el historial):

```powershell
$env:ADMIN_CLAVE = Read-Host "Clave de gerencia (8+ caracteres)"
```

```powershell
npx tsx --env-file-if-exists=.env auth/crear-admin.ts tu-correo@dominio.com "Tu nombre"
```

Al terminar, cierra esa terminal (o `Remove-Item Env:DATABASE_URL, Env:ADMIN_CLAVE`) para que tu panel local siga usando el SQLite de siempre.

### 3. Subir el panel a GitHub

Confirma y sube los cambios del panel (incluye `vercel.json`, `.vercelignore` y el soporte de PostgreSQL en `auth/auth.ts`).

### 4. Render: dos servicios web (plan Free)

Genera un secreto (cualquier generador de 32+ caracteres, p. ej. `openssl rand -base64 32`) y usa **el mismo** en los dos servicios.

**blissens-api** · *New → Web Service* → repositorio del backend, rama `dev`

| Campo | Valor |
|---|---|
| Runtime | Python |
| Build command | `pip install .` |
| Start command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Variables | `PYTHON_VERSION=3.12.7` · `DATABASE_URL=postgresql+psycopg://…` · `BETTER_AUTH_SECRET=…` · `AUTH_HABILITADA=true` · `CORS_ORIGENES=https://TU-APP.vercel.app` · `WHATSAPP_MODO=simulacion` · `CARGA_AUTOMATICA=false` · `FECHA_CORTE=` (vacío = hoy) |

**blissens-auth** · *New → Web Service* → repositorio del panel

| Campo | Valor |
|---|---|
| Runtime | Node |
| Build command | `npm ci` |
| Start command | `npx tsx auth/servidor.ts` |
| Variables | `NODE_VERSION=22` · `DATABASE_URL=postgresql://…` · `BETTER_AUTH_SECRET=…` (el mismo) · `BETTER_AUTH_URL=https://TU-APP.vercel.app` |

Anota las dos direcciones que te da Render (`https://blissens-api-xxxx.onrender.com`, `https://blissens-auth-xxxx.onrender.com`).

### 5. Vercel: el panel

1. En `vercel.json` reemplaza `CAMBIAR-blissens-auth.onrender.com` y `CAMBIAR-blissens-api.onrender.com` por las dos direcciones de Render. Confirma y sube.
2. Vercel → *Add New → Project* → importa el repositorio del panel. Detecta Vite solo; no necesita variables.
3. Si la URL final de Vercel no es la que pusiste en `BETTER_AUTH_URL` y `CORS_ORIGENES`, corrígela en Render y redespliega los dos servicios.

### 6. Primer uso

1. Abre `https://TU-APP.vercel.app` y entra con la cuenta de gerencia.
2. **Cargar agenda** → sube los 4 Excel (anonimizados).
3. **Equipo** → horario de la clínica, almuerzo y cuentas del equipo.

Google (opcional): en Google Cloud agrega la URI `https://TU-APP.vercel.app/api/auth/callback/google` y pon `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` en **blissens-auth**.

### Si algo falla

- **«El servidor de datos no responde»**: Render estaba dormido; espera un minuto y recarga.
- **Entra pero todo da 401**: `BETTER_AUTH_SECRET` no es igual en los dos servicios, o `BETTER_AUTH_URL` no es la URL de Vercel.
- **El backend no arranca y el log dice «Faltan las tablas de cuentas»**: corre el paso 2 y redespliega.
- **Error 500 en `/api/v1/panel`**: revisa que el backend desplegado incluya los cambios del paso 1.
- Logs: Render → el servicio → *Logs*.
