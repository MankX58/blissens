# Base de datos `backend/blissens.db`

Guía para el backend en FastAPI: qué guarda cada tabla, quién la escribe y qué valores lleva cada campo.
La estructura exacta (tipos, llaves, índices) está en [`esquema.sql`](esquema.sql), generado desde la base con `python scripts/esquema.py`.

## Reglas generales

| Tema | Regla |
|---|---|
| Motor | SQLite en modo **WAL**. La comparten FastAPI y Better Auth (Node), así que hay que mantener las transacciones cortas. El `timeout` por defecto de `sqlite3` (5 s) es suficiente. |
| Llaves foráneas | SQLite no las valida si no se pide. En **cada conexión**: `PRAGMA foreign_keys = ON`. |
| Fechas | `DATE` = texto `'YYYY-MM-DD'`. `DATETIME` = `'YYYY-MM-DD HH:MM:SS'` en UTC. Las tablas de Better Auth usan ISO 8601 con zona (`'2026-11-21T16:08:43.344Z'`). |
| Booleanos | `0` / `1`. |
| Dinero | `INTEGER` en pesos colombianos (COP), sin decimales. |
| Teléfonos | `+57` seguido de 10 dígitos (`+573001234567`). Si no hay celular válido, `NULL`. |
| Pacientes | La llave es `numero_paciente` (el `# Paciente` del software de la clínica). En la app se muestra como `#36`. |
| Nombres | Las tablas de la app usan `snake_case` en español. Las de Better Auth usan `camelCase` en inglés (`userId`, `expiresAt`). |
| Quién hizo qué | `registrado_por` / `asignado_por` = `user.id` del usuario de la sesión (`usuario.id` de la dependencia `requiere_rol(...)`). Si se borra la cuenta queda en `NULL`. |
| Mayúsculas | Los valores de catálogo internos van en minúscula y `snake_case` (`'sin_reagendar'`). Los textos que vienen del software (estados de cita, nombres) se guardan tal cual. |

## Quién escribe cada tabla

| Grupo | Tablas | Quién escribe | FastAPI |
|---|---|---|---|
| Cuentas | `user`, `session`, `account`, `verification` | Better Auth (`auth/`) | **Solo lectura**, con `app/modules/auth/sesion_service.py` del backend. Las cuentas se crean y cambian desde la pantalla *Cuentas*. |
| Catálogos | `especialidades`, `profesionales`, `sucursales`, `sillones`, `usuarios_sistema`, `estados_cita`, `eventos_cita`, `aranceles`, `categorias_arancel`, `acciones_arancel`, `guiones` | ETL del backend (`app/modules/ingesta_excel/`) | Lectura. |
| Agenda importada | `citas`, `cita_eventos`, `tratamientos`, `apoderados` | Carga de Excel (`scripts/`) | Lectura. Escritura solo al cargar un Excel nuevo. |
| Pacientes | `pacientes`, `etiquetas_paciente` | Carga de Excel + reglas | Ficha: lectura. `estado_seguimiento`, `motivo_cancelacion` y `recuperado_el` cambian con el trabajo del día. Las columnas calculadas se recalculan (ver abajo). |
| Trabajo del panel | `contactos_seguimiento`, `notas_paciente`, `ciclos_seguimiento`, `agenda_libre`, `ofertas_cupo`, `campanas`, `envios_campana`, `horarios_profesional`, `pausas_agenda`, `ausencias` | **FastAPI** | Lectura y escritura: el panel registra aquí todo lo que se trabaja (recargar los Excel no lo borra). |
| Control | `cargas_excel`, `configuracion` | Carga de Excel / FastAPI | Lectura y escritura. |

## Roles

Los roles viven en `user.role`. El panel y Better Auth los definen una sola vez en `src/lib/roles.ts`, con qué hace, qué ve y qué no ve cada uno. Para proteger un endpoint: `Depends(requiere_rol(...))`. `direccion` (Gerencia) pasa siempre.

| `user.role` | Se muestra como | Secciones | Qué **no** debe recibir de la API |
|---|---|---|---|
| `auxiliar` | Recepción y seguimiento | Inicio, Hoy toca contactar, Pacientes, Agenda libre, Campañas, Cargar agenda | Indicadores, cuentas |
| `especialista` | Especialista | Inicio, Mis pacientes, Mi agenda libre | **Pacientes y cupos de otro especialista.** Filtrar con `user.profesional` (`'Dra. Sara López'` \| `'Dr. Juan Manuel Olarte'`) contra `pacientes.profesional_principal` y `agenda_libre.profesional` |
| `direccion` | Gerencia | Todas + Indicadores + Cuentas | — |

No hay rol de campañas: en la clínica la misma auxiliar lleva la agenda y el WhatsApp, y una campaña es el paso que sigue cuando el 3-7-15 no funcionó. Separarlo obligaría a pasar pacientes de una persona a otra sin ganar nada.

`requiere_rol(...)` devuelve `UsuarioSesion(id, nombre, email, rol, profesional)`. El especialista ya queda limitado a su agenda en el backend: `agenda_permitida(usuario)` da su `profesional` (o `None` si no hay límite) y `comprobar_agenda(usuario, profesional)` responde 403 si el paciente o cupo es de otra agenda. Ejemplo (así está `GET /api/v1/pacientes`):

```python
@enrutador.get("")
def listar(profesional: str | None = None, usuario=Depends(requiere_rol("auxiliar", "especialista"))):
    profesional = agenda_permitida(usuario) or profesional  # el especialista solo ve su agenda
    ...
```

---

## Cuentas (Better Auth)

| Tabla | Campos clave |
|---|---|
| `user` | `id` (texto), `name`, `email` (único), `emailVerified`, `image`, **`role`** (`auxiliar` \| `especialista` \| `direccion`), **`profesional`** (solo especialistas: su agenda; lo asigna gerencia), `banned` (1 = desactivada), `banReason`, `banExpires`, `createdAt`, `updatedAt` |
| `session` | `token` (el valor de la cookie antes del `.`), `userId` → `user.id`, `expiresAt`, `ipAddress`, `userAgent`, `impersonatedBy` |
| `account` | `userId` → `user.id`, `providerId` (`'google'` o `'credential'`), `accountId`, `password` (hash, solo con `'credential'`). Tokens de Google: `accessToken`, `refreshToken`, `idToken`, `accessTokenExpiresAt`, `refreshTokenExpiresAt`, `scope` (**secretos: nunca devolverlos en la API**). |
| `verification` | `identifier`, `value`, `expiresAt`. Estados temporales del inicio con Google. No se usa desde Python. |

Una sesión es válida si la firma de la cookie cuadra con `BETTER_AUTH_SECRET`, `expiresAt` es futuro y el usuario no tiene `banned = 1` vigente. Eso lo hace `app/modules/auth/sesion_service.py` del backend.

## Catálogos

| Tabla | Llave | Campos y valores |
|---|---|---|
| `especialidades` | `id_especialidad` | `codigo` (`'RO'`), `descripcion` (`'Rehabilitación Oral'`) |
| `profesionales` | `id_profesional` | `nombre_mostrar` (`'Dra. Sara López'`, `'Dr. Juan Manuel Olarte'`), `nombres`, `apellidos`, `id_especialidad`, `activo` |
| `sucursales` | `id_sucursal` | `nombre`, `direccion` |
| `sillones` | `id_sillon` | `id_sucursal`, `nombre` (`'Sillon 1'`), `activo`. Único por (`id_sucursal`, `nombre`). |
| `usuarios_sistema` | `id_usuario` | `nombre_usuario`. Son los usuarios **del software de la clínica** (quién agendó la cita), no las cuentas del panel. |
| `estados_cita` | `id_estado` | `nombre` (texto del software) y la regla de negocio de cada estado: `es_atendida`, `es_friccion` (cuenta para "sin reagendar"), `es_friccion_kpi`, `cuenta_como_fallo` (suma al riesgo), `es_confirmacion`. **Usar estas columnas en vez de comparar textos.** |
| `eventos_cita` | `id_evento` | `codigo` (`'atendido'`, `'en_sala_de_espera'`…), `descripcion`. Son las 24 columnas Sí/No del Excel. |
| `aranceles` | `id_arancel` | `nombre` (`'Arancel Base'`) |
| `categorias_arancel` | `id_categoria` | `nombre` (`'ACCIONES DE PERIODONCIA'`…) |
| `acciones_arancel` | `id_accion` | `codigo_accion`, `nombre_accion`, `categoria`, `uco`, `precio_cop`, `habilitado`, `id_categoria`, `id_arancel` (`nombre_arancel` repite el nombre como texto). Base para estimar `pacientes.valor_estimado_cop`. |
| `guiones` | `id` | `categoria` (`'04. Seguimiento y reactivación'`…), `situacion`, `mensaje_plantilla` (con `[NOMBRE]`, `[FECHA]`, `[HORA]`, `[ASESOR/A]`…), `variables_json` (lista JSON de esas variables), `notas_equipo`, `fila_excel` |

## Agenda importada

**`citas`** (`numero_cita`): una fila por cita del software.

| Campo | Valores |
|---|---|
| `numero_paciente` | → `pacientes` |
| `fecha_cita`, `hora_inicio`, `hora_fin` | `DATE` y `'HH:MM'` |
| `estado_actual` / `id_estado` | Texto del software / → `estados_cita`. Ej.: `'Atendido'`, `'No asiste'`, `'Anulado por pcte. via Whatsapp'`. |
| `tipo_atencion` | `'Diagnóstico'` \| `'Tratamiento'` |
| `antiguedad_cita` | `'Nuevo'` \| `'Antiguo'` \| `'No Aplica'` |
| `profesional` / `id_profesional`, `sillon` / `id_sillon`, `sucursal` / `id_sucursal` | Texto original / llave al catálogo |
| `id_usuario_agendo` | → `usuarios_sistema` |
| `numero_tratamiento` | → `tratamientos` (sin restricción en SQLite; el ETL del backend lo mantiene) |
| `orden_fila_excel` | Posición en el Excel. **Dentro del mismo día, la primera fila es la más reciente.** |
| `comentario_cita`, `motivo_atencion`, `tipo_paciente`, `fecha_creacion_cita`, `mes_cita`, `anio_cita`, `en_archivo_octubre`, `especialidad` | Datos del Excel |

| Tabla | Llave | Campos |
|---|---|---|
| `cita_eventos` | (`numero_cita`, `id_evento`) | `activo`: qué eventos tuvo cada cita |
| `tratamientos` | `numero_tratamiento` | `numero_paciente`, `id_especialidad`, `tipo_atencion` (`'Diagnóstico'` \| `'Tratamiento'`), `convenio_tratamiento`, `fecha_generacion` |
| `apoderados` | `id_apoderado` | `nombre_completo`, `numero_identificacion`, `telefono`, `celular` |

## Pacientes

**`pacientes`** (`numero_paciente`)

*Ficha*

| Campo | Valores |
|---|---|
| `nombre_completo`, `nombres`, `apellidos`, `numero_identificacion`, `numero_interno`, `fecha_nacimiento` | Datos del software |
| `telefono_normalizado` | `+57…` o `NULL` |
| `sin_celular` | 1 si no hay celular válido |
| `telefono_secundario`, `email`, `apoderado` (texto), `id_apoderado` | Contacto |
| `estado_contacto` | `'whatsapp_disponible'` \| `'solo_email'` \| `'sin_contacto_en_ficha'` \| `'sin_ficha_contacto'` |
| `tiene_ficha_contacto`, `fuente_telefono` (`'celular'`) | Contacto |
| `convenio_paciente`, `observaciones_medicas`, `tipo_paciente`, `habilitado` | Ficha |
| `origen` | `'excel'` \| `'manual'` (alta desde el panel) |
| `creado_el` | `DATE` |

*Clasificación* (la calculan las reglas en cada carga)

| Campo | Valores |
|---|---|
| `segmento_cartera` | `'sin_reagendar'` (última cita en fricción) \| `'activo'` (tiene cita confirmada: fuera de la bandeja) \| `'diagnostico'` (diagnóstico sin tratamiento) \| `'pausa_control'` (tratamiento en pausa o control de limpieza) |
| `caso_seguimiento` | `'cancelo'` \| `'no_asistio'` \| `'diagnostico'` \| `'pausa'` \| `'limpieza'` \| `NULL` si está activo |
| `perfil_comercial` | `'local'` \| `'internacional'` \| `'deportista'` |
| `antiguedad_actual` | `'nuevo'` \| `'antiguo'` |
| `ingreso_como_nuevo` | Booleano |
| `profesional_principal` | `'Dra. Sara López'` \| `'Dr. Juan Manuel Olarte'` |
| `ultima_fecha_cita`, `ultimo_estado_cita`, `ultimo_comentario`, `numero_ultima_cita`, `ultima_atendida` | Última cita |
| `total_citas`, `total_atendidas`, `tratamientos_atendidos`, `diagnosticos_atendidos` | Conteos |

*Riesgo*

| Campo | Valores |
|---|---|
| `fallos_historicos` | Todas las citas sin cumplir |
| `fallos_seguidos` | Sin cumplir desde la última atendida. **Define el riesgo.** |
| `nivel_riesgo` | `'alto'` (3+ seguidas) \| `'medio'` (1-2 seguidas o 3+ en total) \| `'bajo'` |
| `score_riesgo` | 0-100 = `fallos_seguidos` × 100 / 3, con tope en 100 |
| `requiere_doble_confirmacion` | 1 si `fallos_seguidos` ≥ 3 |
| `es_vip`, `motivo_vip` | VIP (RN-08) y por qué: `'Internacional'` \| `'Deportista de alto nivel'` \| `'Plan de $10 M o más'` \| `'Implantes'` \| `'Rehabilitación oral'` \| `'Coronas'` \| `'Carillas o diseño de sonrisa'` \| `'Alineadores'` \| `'Valoración virtual (paciente del exterior)'` |
| `es_control_limpieza`, `pausa_mayor_30_dias` | Booleanos |

*Seguimiento 3-7-15* (lo cambia el trabajo del panel)

| Campo | Valores |
|---|---|
| `estado_seguimiento` | `'pendiente'` (en la bandeja) \| `'recuperado'` (agendó) \| `'descartado'` (sacado a mano) \| `'agotado'` (pasó el día 15 sin respuesta) \| `'activo'` (tiene cita confirmada) |
| `motivo_cancelacion` | `'costos'` \| `'agenda'` \| `'viaje'` \| `'miedo'` \| `'salud'` \| `'otro'` \| `'sin_dato'` |
| `recuperado_el` | `DATE` en que agendó |

*Foto a la fecha de corte* (`configuracion.fecha_corte`). El panel las recalcula con la fecha de trabajo, así que no hay que usarlas como verdad en otra fecha.

| Campo | Valores |
|---|---|
| `fecha_evento` | Desde cuándo corre el 3-7-15 del ciclo vigente: la última cita; +30 días en *pausa* (RN-03); +4 o 6 meses en *limpieza* (RN-04). |
| `dias_desde_evento` | Días desde `fecha_evento` (foto a la fecha de corte). |
| `semaforo` | `'rojo'` (0-3 días, VIP o riesgo alto) \| `'amarillo'` (4-14 días) \| `'verde'` (15+ días o limpieza) |
| `paso_protocolo_actual` | `3` \| `7` \| `15` \| `NULL` |
| `fecha_proximo_contacto` | `DATE` |
| `toca_hoy` | Booleano |

*Valor*

| Campo | Valores |
|---|---|
| `valor_estimado_cop` | Pesos colombianos (COP) |
| `valor_estimado_fuente` | `'arancel_comentario'` \| `'arancel_tipo_cita'` \| `'sin_estimacion'` |
| `accion_arancel_referencia` | Acciones del arancel usadas, separadas por `' + '` |

Las reglas están en el dominio del backend (`app/domain/`): `clasificador_cartera.py` (segmento, caso, desde cuándo corre el 3-7-15, fallos seguidos) y `evaluador_semaforo_y_riesgo.py` (3-7-15 por días, semáforo, riesgo). El panel aplica las mismas en `src/lib/reglas.ts`.

**`etiquetas_paciente`** (`numero_paciente`, `etiqueta`): `'VIP'` \| `'Valoración virtual'` \| `'Rehabilitación'` \| `'Alineadores'` \| `'Convenio FLAIRES'`.

## Trabajo del panel (lo escribe FastAPI)

**`contactos_seguimiento`** (`id` autoincremental): cada intento de contacto.

| Campo | Valores |
|---|---|
| `numero_paciente` | → `pacientes` |
| `fecha` | `DATE` |
| `paso` | `3` \| `7` \| `15` (día del protocolo) |
| `resultado` | `'agendo'` \| `'sin_respuesta'` \| `'lo_pensara'` \| `'no_interesa'` |
| `motivo` | Igual que `pacientes.motivo_cancelacion` |
| `mensaje` | Texto enviado. Si fue una asignación de cupo: `'(asignado a la agenda libre …)'`. |
| `nota` | Opcional |
| `cupo_id` | → `agenda_libre.id` si el contacto terminó en un cupo (sin restricción en SQLite: validar en FastAPI) |
| `registrado_por` | → `user.id` |

Si `resultado = 'agendo'`, el paciente pasa a `estado_seguimiento = 'recuperado'` y `recuperado_el = fecha`.

| Tabla | Llave | Campos |
|---|---|---|
| `notas_paciente` | `id` | `numero_paciente`, `fecha`, `texto`, `registrado_por` |
| `ciclos_seguimiento` | `id` | Procesos 3-7-15 ya cerrados de un paciente (cuando vuelve a caer con un caso nuevo). `caso` (como `caso_seguimiento`), `fecha_evento`, `cierre` (como `estado_seguimiento`), `motivo`, `contactos_json` (lista JSON de `{fecha, paso, resultado, mensaje, nota?}`). |

**`agenda_libre`** (`id`): un cupo libre de la agenda. **Se calcula solo** (`app/modules/equipo/tiempo_libre.py`, en cada `GET /api/v1/panel`, para los 14 días desde la fecha de trabajo):

> tiempo libre = horario del especialista (`horarios_profesional`) − descansos (`pausas_agenda`) − citas agendadas con hora (las `Anulado`, `Anulado por pcte. via Whatsapp` y `Cambio de fecha` liberan el espacio) − cupos que ya existen; nada en los días de `ausencias`.

Lo libre se parte en cupos de 60 min (un resto de 30 min o más también se ofrece). Al recalcular se borran solo los cupos calculados que nadie tocó (sin `ocupado_por`, ofertas ni `verificacion`).

Cuándo **no** se calcula un día (y el panel lo explica en vez de mostrar cupos falsos):

| Caso | Por qué | Campo del panel |
|---|---|---|
| Sin ninguna cita ni cupo ese día | Aún no se ha agendado (fechas lejanas), el Excel no llega hasta ahí o es festivo: no es un hueco por llenar | `agenda_sin_citas` (cuántos días) y `agenda_cubierta_hasta` (última fecha con citas en el Excel) |
| Citas **sin hora** en el Excel | No se sabe qué parte del día está ocupada | `agenda_sin_hora` |
| Especialista sin horario | No hay con qué calcular | `sin_horario` |
| Vacaciones o ausencia | — | — |

**Datos al día, sin revisar cupo por cupo.** El riesgo de un cupo calculado es que alguien lo haya agendado después de la última carga del Excel. Se cubre de dos formas:

- El panel devuelve `ultima_carga` (fecha y hora de la última carga completada en `cargas_excel`). Si tiene más de 24 h, la agenda libre y el Inicio de recepción piden cargar el Excel del día: una carga pone al día todos los cupos.
- Si al agendar un paciente en el software el horario ya estaba tomado, recepción lo marca («ya estaba ocupado»: `POST /api/v1/agenda/huecos/verificar` con `{ids, libre: false}`). Queda como bloqueo: no se lista, no cuenta en indicadores y el recálculo no vuelve a crear ese tiempo. **Se puede deshacer** (`libre: null`): el panel devuelve los bloqueados en `cupos_ocupados` y la agenda los muestra en «Marcados como ocupados» con «Volver a mostrar».
- **La agenda se actualiza sola** desde una de tres fuentes (`app/modules/ingesta_excel/carga_automatica.py`; el panel lo informa en `fuente_agenda` y `fuente_error`):
  | Fuente | Cómo se configura | Cuándo se recarga |
  |---|---|---|
  | **Enlace en línea** (Google Sheets, Google Drive, OneDrive/SharePoint, https a un .xlsx) | Gerencia lo pega en *Cargar agenda → Conectar archivo en línea* (se prueba antes de guardarlo; queda en `configuracion` con las claves `agenda_url` y `agenda_detalle_url`) o `AGENDA_URL` / `AGENDA_DETALLE_URL` en el `.env` | Se revisa cada `REVISAR_FUENTE_MIN` (15) min y solo se recarga si el contenido cambió |
  | **Base de datos en línea** del software | `AGENDA_BD_URL` (URL de SQLAlchemy) + `AGENDA_BD_CONSULTA` (y `_DETALLE`) en el `.env`: consultas que devuelven las mismas columnas del Excel. Solo en el `.env` porque lleva contraseña | Igual que el enlace |
  | **Carpeta** (`CARGA_AUTOMATICA=true`) | La exportación guardada en `RUTA_DATOS_EXCEL`, p. ej. una carpeta sincronizada | Cuando el archivo es más nuevo que la última carga |

  Endpoints: `GET /api/v1/ingesta/fuente` (estado), `PUT /api/v1/ingesta/fuente` (gerencia: `{enlace, enlace_detalle}`; vacíos = desconectar), `POST /api/v1/ingesta/fuente/actualizar` (revisar ahora). Si la fuente falla, el panel sigue con la última agenda cargada y muestra el motivo en palabras sencillas (nunca el enlace ni contraseñas). Una fuente que trae solo la agenda conserva los guiones y el arancel de la carpeta.

`GET /api/v1/equipo/sugerido` (gerencia) deduce un horario de las citas con hora: días de la semana con al menos 3 citas, de la primera a la última hora con citas, y el almuerzo en la hora entre 11:00 y 14:00 que casi no tiene citas.

| Campo | Valores |
|---|---|
| `fecha`, `hora` (`'HH:MM'`), `minutos` | Duración |
| `origen` | `'calculado'` (sale del horario) \| `'manual'` (lo agregó recepción, p. ej. una cancelación que aún no llega en el Excel) |
| `verificacion` | Solo calculados: `NULL` (normal) \| `'ocupado'` (al agendarlo en el software ya estaba tomado: bloqueo que no se muestra) \| `'libre'` (confirmado libre; el recálculo lo conserva) |
| `profesional` / `id_profesional`, `sillon` / `id_sillon` | Texto / llave al catálogo |
| `ocupado_por` | → `pacientes`. `NULL` = libre. |
| `asignado_el` (`DATE`), `asignado_por` (→ `user.id`) | Asignación |
| `estado_previo` | `estado_seguimiento` que tenía el paciente antes de asignarle el cupo, para poder revertir |
| `confirmado_el` | `DATE` de la confirmación 24 h antes |
| `asistencia` | `'asistio'` \| `'no_asistio'` \| `NULL`. Si es `'no_asistio'`, el paciente vuelve al 3-7-15 con `caso = 'no_asistio'`. |

**`horarios_profesional`** (`id`): franja semanal de atención. `profesional` (`'Dra. Sara López'` \| `'Dr. Juan Manuel Olarte'`), `dia_semana` (0 = lunes … 6 = domingo), `inicio`, `fin` (`'HH:MM'`). Puede haber varias franjas por día. La define gerencia en *Equipo* (`PUT /api/v1/equipo/horarios`).

**`pausas_agenda`** (`id`): descansos diarios de la clínica (almuerzo, pausas): `nombre`, `inicio`, `fin`. Nunca cuentan como agenda libre (`PUT /api/v1/equipo/pausas`).

**`ausencias`** (`id`): vacaciones u otra ausencia de **cualquier cuenta**. `user_id` → `user.id` (se borra con la cuenta), `desde`, `hasta` (`DATE`, ambos incluidos), `motivo` (`'Vacaciones'` \| `'Incapacidad'` \| `'Permiso'` \| `'Capacitación'`), `registrado_por` → `user.id`. Si la cuenta es de un especialista (`user.profesional`), esos días su agenda no tiene tiempo libre (`POST` / `DELETE /api/v1/equipo/ausencias`).

**`ofertas_cupo`** (`id`): a quién se le ofreció un cupo. `cupo_id` → `agenda_libre`, `numero_paciente`, `fecha`, `rechazo` (1 = "No puede"), `registrado_por`.

**`campanas`** (`id`)

| Campo | Valores |
|---|---|
| `nombre` | Nombre de la campaña |
| `audiencia` | Segmento elegido (texto) |
| `plantilla` | Texto con variables (`[NOMBRE]`…) |
| `creada_el`, `inicio` | `DATETIME` |
| `ritmo_seg` | Segundos entre mensajes |
| `canal` | `'api'` (WhatsApp Business Cloud API) \| `'simulado'` |
| `estado` | `'programada'` \| `'enviando'` \| `'pausada'` \| `'completada'` \| `'cancelada'` |
| `registrado_por` | → `user.id` |

**`envios_campana`** (`id`): un mensaje por paciente. `campana_id` → `campanas`, `numero_paciente`, `nombre_paciente`, `telefono`, `texto` (ya con las variables reemplazadas), `estado` (`'pendiente'` \| `'enviado'` \| `'respondio'` \| `'fallo'` \| `'omitido'`), `fecha_envio`, `error`.

## Control

| Tabla | Llave | Campos |
|---|---|---|
| `cargas_excel` | `id` | Una fila por carga: `fecha_carga`, `duracion_ms`, `total_citas`, `total_pacientes`, `citas_enriquecidas_octubre`, `guiones_cargados`, `acciones_arancel_cargadas`, `estado` (`'completada'` \| `'alineada_con_app'`), `fecha_corte`, `registrado_por` |
| `configuracion` | `clave` | `clave` → `valor` (texto): `'asesora'` (quien firma los guiones: `[ASESOR/A]`), `'fecha_corte'` (`DATE` de la última agenda cargada), `'regla_riesgo'`, `'regla_semaforo'` (descripción de las reglas) |
