# Blissens · Hoy toca contactar

Panel diario para la auxiliar administrativa de Blissens Odontología: lee la agenda exportada en Excel, detecta a los pacientes que se están perdiendo y arma la lista de contacto del día con la regla 3-7-15.

## Roles y secciones

Cada persona entra a un **Inicio** propio: su foco del día, sus responsabilidades con su avance (cada tarjeta lleva a su sección), una lectura de sus datos y qué hace, ve y no ve su rol. Los roles salen del proceso real de la clínica y están definidos en `src/lib/roles.ts`.

**Recepción y seguimiento** (auxiliar / recepcionista) · que ningún paciente quede sin reagendar ni ningún cupo vacío
- **Hoy toca contactar**: lista del día por semáforo (rojo = 0 a 3 días, VIP o riesgo alto; amarillo = día 7; verde = día 15) y valor. En *Contactar* se elige el guion, se abre WhatsApp con el mensaje listo y se registran la respuesta y el motivo.
- **Pacientes**: expediente con el proceso 3-7-15, historia completa (contactos, campañas, citas, notas, procesos anteriores), notas internas, reactivar o sacar del seguimiento y alta manual.
- **Agenda libre**: el tiempo libre de los próximos 14 días se **calcula solo**: horario de cada especialista − descansos de la clínica − citas agendadas − vacaciones. Solo en días que ya tienen agenda abierta (al menos una cita): un día vacío lejano o festivo no se ofrece como libre. No hay que revisar cada cupo: la agenda avisa si el Excel tiene más de un día (una carga diaria pone todo al día) y, si al agendar en el software un horario ya estaba tomado, se marca «ya estaba ocupado» (se puede deshacer). La agenda puede **actualizarse sola** desde un archivo en línea (Google Sheets, Drive, OneDrive o SharePoint: gerencia pega el enlace en *Cargar agenda*), desde la base de datos del software (configurada en el `.env` del backend) o desde una carpeta sincronizada. Cada cupo trae pacientes sugeridos (mismo especialista, alto valor primero), ofertas, asignación con opción de revertir, confirmación 24 h antes y asistencia. Si no asiste, vuelve solo a la regla 3-7-15. Recepción puede agregar un cupo a mano para lo que el cálculo aún no ve.
- **Campañas**: cuando el 3-7-15 no funcionó, el siguiente paso es una campaña de WhatsApp por segmento (sin respuesta tras 3-7-15, diagnóstico sin tratamiento, pausa, FLAIRES…) con mensaje personalizado, envío ahora o programado. Sin conexión, modo simulación; con WhatsApp Business Cloud API salen de verdad. Es la misma persona y el mismo canal que el seguimiento diario, por eso no es un rol aparte.
- **Cargar agenda**: lee el Excel del software; las cancelaciones liberan su espacio en la agenda libre calculada.

**Especialista** (Dra. Sara López, Dr. Juan Manuel Olarte) · que sus pacientes terminen el tratamiento
- Ve **solo sus pacientes y su agenda libre** (gerencia le asigna su agenda en *Equipo*): tratamientos en pausa, diagnósticos sin iniciar, riesgo alto y a quién retomar primero. Deja notas para orientar a recepción.
- **No contacta ni crea cupos**: su tiempo libre sale de su horario y sus citas, y recepción es quien escribe y agenda. Así no se duplica el trabajo ni aparecen cupos que nadie verificó.

**Gerencia** · decidir con datos
- Inicio con KPIs (por recuperar, dinero detenido, recuperados, tasa de recuperación) y el avance de cada área. Entra a todas las secciones; en Campañas decide a qué segmentos apuntar y revisa la respuesta.
- **Indicadores**: fricción, motivos, efectividad por intento, segmentos, agenda libre y campañas; tablas descargables en Excel.
- **Equipo**: crear y editar cuentas (nombre, correo, contraseña), asignar rol y agenda, desactivar; **horario** de cada especialista (con un horario **sugerido** a partir de las citas cargadas), **descansos** de la clínica (almuerzo, pausas) y **vacaciones** por rango de fechas. De ahí sale la agenda libre.

## Arquitectura

```text
ESTUD-IA/
├── blissens/                 este repo: panel (React + Vite) y login (Better Auth)
│   ├── src/                  pantallas, reglas en pantalla y cliente del backend (src/lib/api.ts)
│   ├── auth/                 Better Auth: contraseña y Google; cuentas, roles y agenda del especialista
│   ├── backend/blissens.db   la base SQLite compartida (en .gitignore: datos de pacientes)
│   └── docs/                 ESQUEMA.md (qué es cada campo) y esquema.sql (generado)
├── blissens-backend/         FastAPI + pandas + openpyxl: ETL de los Excel, reglas, permisos y API REST
└── Archivos Blissens Odontologia/   los 4 Excel de la clínica (RUTA_DATOS_EXCEL del backend)
```

| Pieza | Qué hace |
|---|---|
| **Backend** (`../blissens-backend`) | Fuente de verdad. Lee los Excel con su ETL, guarda todo en `backend/blissens.db`, aplica las reglas (3-7-15, semáforo, riesgo) y los permisos por rol, y envía las campañas por WhatsApp (el token vive en su `.env`). |
| **Better Auth** (`auth/`) | Inicio de sesión. Escribe `user`, `session`, `account` y `verification` en la misma base; el backend valida esa cookie. |
| **Panel** (`src/`) | Al entrar pide `GET /api/v1/panel`: lo que el rol puede ver, ya recortado por el backend. Cada acción (contacto, nota, cupo, campaña, carga de Excel) llama a su endpoint y muestra lo que el backend devuelve. No guarda datos en el navegador. |

En desarrollo Vite atiende `/api/auth` (Better Auth) y pasa el resto de `/api` al backend en `:8000`, con la misma cookie.

## Puesta en marcha

```bash
# backend (una vez): en ../blissens-backend
python -m venv .venv && .venv\Scripts\python -m pip install -e ".[dev]"
copy .env.example .env    # DATABASE_URL=sqlite:///../blissens/backend/blissens.db, mismo BETTER_AUTH_SECRET que el panel, AUTH_HABILITADA=true

# panel (una vez): aquí
npm install
copy .env.example .env    # BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

# cada día, en dos terminales
npm run api               # backend en http://localhost:8000 (docs en /docs)
npm run dev               # panel + login en http://localhost:3000
```

Primera cuenta de gerencia: `npx tsx --env-file=.env auth/crear-admin.ts correo@dominio.com`. El resto se crea en *Cuentas*.

En Google Cloud Console (*APIs y servicios → Credenciales → ID de cliente OAuth, aplicación web*) el URI de redirección autorizado es `http://localhost:3000/api/auth/callback/google` (en producción, el dominio del panel). Si cambian las tablas de Better Auth: `npx @better-auth/cli@1.4.21 migrate --config auth/auth.ts -y`. En producción Better Auth corre aparte con `npm run auth` (`:4000`).

## Datos

La base la construye el **ETL del backend** desde los 4 Excel del software (885 citas, 255 pacientes: 115 sin reagendar, 50 diagnóstico sin tratamiento, 74 pausa/control, 16 activos):

- **Cargar agenda** (recepción) sube los Excel al backend (`POST /api/v1/ingesta/cargar-archivos`); en *Ajustes* se pueden releer desde la carpeta del servidor.
- **Recargar no borra lo trabajado.** Se conservan contactos, notas, procesos anteriores, cupos, ofertas, envíos de campañas, pacientes agregados a mano, el especialista reasignado y el celular si el Excel nuevo no lo trae. Si un paciente tiene un evento nuevo (por ejemplo, volvió a cancelar), sus contactos pasan a "procesos anteriores" y empieza un 3-7-15 limpio.
- `datos/` (en `.gitignore`) guarda `blissens_odontologia.db`, el modelo normalizado de origen, y respaldos de la base.

Estructura y significado de cada campo: [`docs/ESQUEMA.md`](docs/ESQUEMA.md). `python scripts/esquema.py` regenera [`docs/esquema.sql`](docs/esquema.sql) desde la base.

## Reglas (backend y panel aplican las mismas)

- **3-7-15 (RN-05):** la etapa la marcan los días desde el evento: **rojo** urgente 0-3 días (también VIP y riesgo alto), **amarillo** día 7 (4-14 días), **verde** rescate día 15 (15+ días o control de limpieza). Un intento por etapa: quien canceló hace 40 días y no ha sido contactado va directo al rescate del día 15; si no responde, queda "agotado" y pasa a la campaña "Sin respuesta al 3-7-15". El día 3 se atiende apenas ocurre el evento.
- **Desde cuándo corre:** la última cita; en *tratamiento en pausa*, cuando pasan 30 días sin volver (RN-03); en *control de limpieza*, a los 4 meses o a los que diga el comentario ("Limpieza 6 meses") (RN-04).
- **Riesgo (RN-06):** cuentan los fallos (Cambio de fecha, Anulado, Anulado por WhatsApp, No asiste, No confirmado) **desde la última vez que asistió**: Alto = 3+ seguidos (doble confirmación 24 h antes); Medio = 1-2 seguidos o 3+ en total.
- **VIP (RN-08):** al menos uno: paciente internacional (o valoración virtual), deportista de alto nivel, tratamiento de alto valor (implantes, rehabilitación oral, coronas, carillas o diseño de sonrisa, alineadores) o plan estimado de $10 M o más. El backend guarda el motivo (`pacientes.motivo_vip`) y el panel lo muestra en la ficha.
- **Orden de todas las listas:** urgencia → VIP → riesgo alto → valor del tratamiento. En la app, "¿Cómo se prioriza?" lo explica.

La fecha de trabajo arranca en el cierre de la agenda cargada y se cambia en *Ajustes* (queda guardada en el backend).

## Desarrollo

```bash
npm run lint                       # tipos del panel
npx tsx src/lib/reglas.check.ts    # regla 3-7-15, semáforo, celulares, guiones y motor de campañas
npx tsx src/lib/excel.check.ts     # cifras del SRS sobre los Excel reales y casos de QA
# en ../blissens-backend
.venv\Scripts\pytest               # 90 pruebas: dominio, ETL, QA del SRS, API, permisos por rol y recarga sin pérdida
```
