# Blissens · Hoy toca contactar

Panel diario para la auxiliar administrativa de Blissens Odontología: lee la agenda exportada en Excel, detecta a los pacientes que se están perdiendo y arma la lista de contacto del día con la regla 3-7-15.

## Secciones (agrupadas por rol)

**Auxiliar administrativa**
- **Hoy toca contactar**: lista del día por semáforo (rojo = último intento o atrasado, amarillo = día 7, verde = día 3) y valor. En *Contactar* se elige el guion, se abre WhatsApp con el mensaje listo y se registra la respuesta y el motivo.
- **Pacientes**: expediente de cada paciente con su proceso 3-7-15, historia completa (contactos, campañas, citas, notas, procesos anteriores), notas internas, reactivar o sacar del seguimiento y alta manual.
- **Cargar agenda**: lee el Excel del software; las cancelaciones futuras se convierten en cupos de la agenda libre. Si un paciente ya existía, su proceso anterior queda en el expediente.

**Recepción y agenda**
- **Agenda libre**: cupos disponibles con pacientes sugeridos (mismo especialista, alto valor primero), registro de a quién se le ofreció, asignaciones con opción de revertir y marcar asistencia. Si no asiste, el paciente vuelve solo a la regla 3-7-15.

**Campañas de reactivación**
- **Campañas automáticas**: audiencia + mensaje con variables + envío ahora o programado, con pausa entre mensajes. Se envían solas mientras el panel está abierto, con avance en vivo, pausa, cancelación y reintento de fallidos. Sin conexión funcionan en modo simulación; con WhatsApp Business Cloud API (token + ID de número, opcionalmente una plantilla aprobada) salen de verdad.

**Dirección y especialistas**
- **Indicadores**: valor recuperado, cancelaciones, inasistencias, tasa de recuperación, actividad de 14 días, motivos, efectividad por intento, recuperación por segmento, agenda libre y campañas. Las tablas (seguimiento, pacientes, agenda libre, campañas) se ven en pantalla con búsqueda y orden, y se pueden descargar una a una o todas en un Excel.

## Inicio de sesión y roles

Cada persona entra con su cuenta y ve solo las secciones de su rol; **dirección** ve todo y gestiona las cuentas en *Cuentas* (crear, cambiar rol, desactivar). No hay registro público: con Google solo entra quien ya tiene cuenta con ese correo.

| Pieza | Dónde | Qué hace |
|---|---|---|
| Better Auth (Node) | `auth/` | login con contraseña y con Google; guarda `user`, `session`, `account`, `verification` en `backend/blissens.db` |
| Backend (FastAPI) | `backend/sesion.py` | valida la misma cookie: `Depends(usuario_actual)` o `Depends(requiere_rol("mercadeo"))` |
| Panel (React) | `src/screens/Login.tsx`, `Cuentas.tsx` | en desarrollo Vite atiende `/api/auth` él mismo y pasa el resto de `/api` a FastAPI (:8000) |

Los roles se definen una sola vez en `src/lib/roles.ts` (panel y Better Auth); `sesion.py` los recibe tal cual desde la base.

```bash
cp .env.example .env            # BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
npm run dev                      # panel + login en http://localhost:3000
npm run auth                     # solo en producción: Better Auth aparte en :4000 (el proxy debe mandarle /api/auth)
uvicorn main:app --port 8000     # (desde backend/) FastAPI
npx tsx --env-file=.env auth/crear-admin.ts correo@dominio.com   # primera cuenta de dirección
```

En Google Cloud Console (*APIs y servicios → Credenciales → ID de cliente OAuth, aplicación web*) el URI de redirección autorizado es `http://localhost:3000/api/auth/callback/google` (en producción, el dominio del panel). Si cambian las tablas de Better Auth (nuevos plugins): `npx @better-auth/cli@1.4.21 migrate --config auth/auth.ts -y`.

## Datos reales

Al abrir el panel por primera vez se leen los 4 Excel de la clínica desde `public/datos/` (también se pueden subir en *Cargar agenda*):

| Archivo | Uso |
|---|---|
| `agenda-citas-estados.xlsx` (Agenda citas y estados) | 885 citas con estado: base de la segmentación, el riesgo y la radiografía |
| `agenda-citas-detalle.xlsx` (Agenda y citas) | celular, correo, apoderado, hora y comentario; se cruza por `# Cita` / `# Paciente` |
| `arancel-precios.xlsx` | precio de las acciones habilitadas para estimar el dinero en pausa |
| `guiones.xlsx` | las 24 plantillas oficiales (integradas en `src/data/guiones.ts`) |

**Segmentos (SRS RF-02):** se agrupan las citas por paciente y se mira la última (en un mismo día, la primera fila del Excel es la más reciente):
1. última cita en fricción (Anulado, Anulado por WhatsApp, Cambio de fecha, No asiste, No confirmado, Notif. WhatsApp fallida) → *Sin reagendar* (115)
2. última confirmada/notificada → *Activo* (16, fuera de la bandeja)
3. diagnóstico atendido y ningún tratamiento atendido → *Diagnóstico sin tratamiento* (50)
4. el resto → *Tratamiento en pausa / control de limpieza* (74)

**Riesgo (RN-06):** 3 o más fallos históricos = 🔥 Riesgo alto y doble confirmación 24 h antes.

> ⚠️ `public/datos/` contiene datos personales de pacientes y está en `.gitignore`. Tras clonar el repo, copia ahí los 4 Excel con esos nombres; si faltan, el panel lo avisa y se pueden subir desde *Cargar agenda*.

## Base de datos del backend

`backend/blissens.db` (SQLite, en `.gitignore` porque tiene datos de pacientes; estructura en [`docs/esquema.sql`](docs/esquema.sql) y guía de cada campo en [`docs/ESQUEMA.md`](docs/ESQUEMA.md)) guarda las citas, los pacientes y las tablas operativas del panel. Para que dé exactamente las mismas cifras que la app, se recalcula con el mismo lector de Excel:

```bash
npx tsx scripts/alinear.ts
```

El script es idempotente y además:
- agrega `pacientes.fallos_seguidos`, `ultima_atendida` y `apoderado`, `ofertas_cupo.rechazo`, `agenda_libre.confirmado_el` y `cargas_excel.fecha_corte`;
- agrega quién hizo cada acción, como llave a `user.id` de Better Auth (queda en `NULL` si se borra la cuenta): `registrado_por` en `contactos_seguimiento`, `notas_paciente`, `campanas`, `ofertas_cupo` y `cargas_excel`, y `asignado_por` en `agenda_libre`. FastAPI lo llena con `usuario_actual(...)["id"]`;
- crea `etiquetas_paciente` (VIP, Valoración virtual, Rehabilitación, Alineadores, Convenio FLAIRES) y `configuracion` (asesora, fecha de corte, reglas);
- recalcula riesgo, caso (con *pausa* separado de *diagnóstico*), antigüedad, celular con `+57`, valor del arancel y la acción usada, y el semáforo y "toca hoy" a la fecha de corte;
- termina comparando la base con la app y falla si hay cualquier diferencia.

Los turnos libres se guardan en `agenda_libre` (cada fila es un cupo) y sus ofertas en `ofertas_cupo`; `contactos_seguimiento.cupo_id` enlaza el contacto con el cupo asignado. `scripts/migrar.ts` renombra las tablas antiguas (`huecos_agenda`, `ofertas_hueco`, `hueco_id`) la primera vez que corre cualquiera de los dos scripts.

### Combinación con el modelo normalizado

`datos/blissens_odontologia.db` (el modelo normalizado de origen, en `.gitignore`) se integra en la base del backend con:

```bash
npx tsx scripts/combinar.ts datos/blissens_odontologia.db
npx tsx scripts/alinear.ts
```

Agrega catálogos (`profesionales`, `especialidades`, `sucursales`, `sillones`, `usuarios_sistema`, `estados_cita`, `eventos_cita`), `tratamientos`, `cita_eventos` (las 24 columnas Sí/No del Excel por cita), `apoderados` y las categorías del arancel; y en `pacientes` la ficha extra (nombres y apellidos por separado, identificación, fecha de nacimiento, teléfono secundario, convenio, observaciones médicas). `estados_cita` guarda la regla de cada estado (`es_atendida`, `es_friccion`, `es_friccion_kpi`, `cuenta_como_fallo`, `es_confirmacion`), así el backend no la escribe a mano. No se importan el riesgo ni la antigüedad calculados en el origen porque usan otras reglas. El script valida que ambas fuentes cuenten la misma historia (estado, profesional, tratamiento, última cita, celular) y falla si algo no cuadra. `citas.numero_tratamiento` es la llave hacia `tratamientos` (SQLite no permite agregar la restricción a una columna existente; el script la valida).

Las columnas `semaforo`, `toca_hoy`, `dias_desde_evento`, `paso_protocolo_actual` y `fecha_proximo_contacto` son una foto a `cargas_excel.fecha_corte`; la app las recalcula con la fecha de trabajo.

## Regla 3-7-15

La etapa la marcan los días desde el evento (RN-05): **rojo** urgente 0-3 días (también VIP y riesgo alto), **amarillo** seguimiento día 7 (4-14 días), **verde** rescate día 15 (15+ días o limpieza preventiva). Un intento por etapa; si el rescate no funciona, el paciente pasa a la campaña "Sin respuesta al 3-7-15". La fecha de trabajo arranca en el cierre de la agenda cargada y se cambia en la barra lateral.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:3000
npx tsx src/lib/reglas.check.ts   # regla 3-7-15, semáforo, celulares, guiones y motor de campañas
npx tsx src/lib/excel.check.ts    # cifras del SRS sobre los Excel reales (885 / 255 / 115-50-74-16 / 461) y casos de QA
```

Los datos se guardan en el navegador (localStorage). "Restaurar datos de ejemplo" en el pie de página vuelve a los datos demo.
