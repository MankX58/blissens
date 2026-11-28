# Cambios necesarios en el backend (blissens-backend, rama `dev`)

El frontend ya consume todo esto como **campos opcionales con respaldo**. Mientras el backend no los mande, el panel aplica sus reglas locales (o guarda la marca como nota). Cuando el backend los publique, el panel los usa solo, sin tocar el frontend. Los nombres son los del contrato acordado.

## 1. ETL: cómo leer el Excel de Dentalink (`etl` → `pacientes`, `citas`)

- **«Confirmado» con fecha pasada = no vino.** Marcar la cita como inasistencia pendiente de depurar.
  - En la cita: `pendiente_depuracion = true`.
  - Cuenta como fallo para `fallos_seguidos` y para el caso `no_asistio`.
  - Hoy cuenta como «por venir».
- **«Anulado» = lo anuló la clínica. «Anulado por pcte. via Whatsapp» = lo anuló el paciente.**
  - El de la clínica NO suma al riesgo del paciente (`fallos_seguidos`, `nivel_riesgo`).
  - Sí abre un caso de seguimiento (hay que reagendarlo, pidiendo disculpas).
- **«Notif. WhatsApp fallida» = número malo o inactivo.**
  - Marca el teléfono como no válido para campañas.
  - Hace que `contactos` acepte el resultado `sin_whatsapp`.
- **«No Aplica» en antigüedad = paciente nuevo.**
- **RO = Revisión Odontológica**: agregarlo al diccionario de tratamientos.
- **«Tipo Paciente»** (columna del Excel de detalle):
  - Leerla y exponerla como `tipo_paciente` en el paciente y en la cita.
  - Si dice Deportista o Internacional, marcar VIP (`motivo_vip`) y `perfil_comercial`.
  - Internacional ⇒ `idioma_preferido = 'en'` por defecto.
- **Profesional tratante ≠ usuario que agenda.** Casi todo se agenda con el usuario del Dr. Olarte en recepción.
  - `profesional_principal` debe salir del profesional que atiende (comentario o tipo de cita), no del usuario.
  - El usuario va aparte en un campo nuevo `agendado_por`.
- **Dr. Juan Esteban** reemplaza a la Dra. Laura Vélez.
  - Agregarlo al catálogo de especialistas, a `ESPECIALISTAS` y a la validación de `equipo_router` (horarios).
  - No colapsar «cualquiera que no sea Olarte» en la Dra. Sara.
- **No llevar observaciones clínicas a `ultimo_comentario` o tratamiento.** Usar el tipo de procedimiento normalizado; el comentario crudo queda solo en la cita.

## 2. Reglas de seguimiento (`pacientes`, `reglas`)

- **Perdido** = más de 60 días sin volver.
  - Campo calculado `es_perdido_60d`.
  - Alimenta la audiencia «Volver a empezar».
- **3 o más cambios de fecha**: campos `cambios_fecha_historicos` (int) y `marca_3_cambios_fecha` (bool).
- **Rojo sostenido**: canceló o no asistió y no ha reagendado ⇒ sigue urgente, sin importar el día. El panel ya lo hace; el orden del backend (`ordenarDelDia`) debe coincidir.
- **Controles**: limpieza cada 6 meses; ortodoncia y alineadores cada mes. Hoy el intervalo es de 4 a 6 meses para todo.
- **No contactar** (nuevo):
  - Campos `no_contactar` (bool) y `motivo_no_contactar` (`tratamiento_terminado | queja_activa | deuda_en_cobro | fallecido | no_le_interesa`).
  - Endpoint `POST /pacientes/{id}/no-contactar {motivo}`: deja al paciente descartado y lo excluye de la lista del día, de las campañas y de los sugeridos de agenda.
  - Respaldo actual del panel: nota «No contactar: …» + `POST /descartar`.
- **Quiere adelantar su cita** (nuevo):
  - Campo `quiere_adelantar_cita` (bool), editable con `PATCH /pacientes/{id}`.
  - `GET /agenda/huecos/{id}/sugeridos` debe incluir pacientes `activo` con esa marca y ponerlos primero.
  - Respaldo actual: nota «Quiere adelantar su cita.» / «Ya no quiere adelantar su cita.».
- **Consentimiento de WhatsApp (Ley 1581)** (nuevo):
  - Campo `consentimiento_whatsapp` (`true | false | null`), editable con `PATCH`.
  - `false` ⇒ excluido de campañas.
  - Respaldo actual: nota «Autorizó / No autorizó escribirle por WhatsApp».
- **Ya tiene chat de WhatsApp** (nuevo): campo `en_chat_whatsapp` (bool), editable con `PATCH`. Respaldo: nota.
- **Resultado `sin_whatsapp`** en `POST /pacientes/{id}/contactos`: marca el número para corregir y lo saca de campañas. Hoy el panel lo manda; si el backend responde 422, reintenta como `sin_respuesta` con nota.
- **Motivos**: el enum `motivo_cancelacion` debe aceptar los mismos chips del panel (`costos, agenda, viaje, miedo, salud, otro, sin_dato`).

## 3. Abonos (nuevo, depende de que la clínica pueda exportar pagos)

- Importar abonos y saldos de Dentalink (Excel de pagos o plan de tratamiento) ⇒ `saldo_pendiente_cop`.
- Calcular `paso_abono_actual` (3 o 7) y `toca_abono_hoy` a partir de la fecha de la valoración o del último abono.
  - Tono de acompañamiento, no cobro.
  - Solo 2 recordatorios: día 3 y día 7.
- Respaldo actual: el panel usa «diagnóstico sin tratamiento» con 3 a 7 días desde el evento.

## 4. Valoración del dinero detenido (`catalogos` / arancel)

- Excluir del promedio del arancel los precios de relleno ($0 y $500.000).
- Valor por **tipo de procedimiento** (implantes, rehabilitación, ortodoncia, valoración virtual…) o, mejor, por el **valor del plan de tratamiento** de Dentalink cuando esté.
- Exponer `valor_estimado_fuente` = `plan | procedimiento | arancel`.

## 5. Agenda (`agenda`, `equipo`)

- **Cupos según duración.**
  - `tipo_cupo`: `valoracion_45` (primera valoración = 45 min) o `control`.
  - `POST /agenda/huecos` ya recibe `tipo_cupo` desde el panel; hoy se ignora.
- **`ventana_anticipacion`**: `mas_24h` o `mismo_dia`. Se ofrece con 24 h de anticipación, pero el mismo día también vale.
- **Horario oficial**: lunes a viernes de 8 a 12 y de 13 a 17, almuerzo de 12 a 13. El panel ya lo aplica con un botón (horario + pausa «Almuerzo»); validar que `/equipo/horarios` acepte al Dr. Juan Esteban.
- **Confirmaciones 24 h**: endpoint de citas futuras de Dentalink que haya que confirmar mañana (el export puede incluir citas futuras).

## 6. Campañas (`campanas`)

- **Cola asistida de WhatsApp Web** (la clínica no tiene API): `POST /campanas/{id}/envios/{envio_id}/marcar-enviado-web` marca ese envío exacto como enviado por recepción.
  - Respaldo actual: `ejecutar-lote` con `tamano_lote: 1`, que marca el primer pendiente.
- **Ventana de envío**: el motor del backend solo debe enviar de lunes a viernes, 8–12 y 13–17. Fuera de ese horario, se reprograma al siguiente bloque.
- **Exclusiones al crear la campaña**:
  - `no_contactar`;
  - `consentimiento_whatsapp = false`;
  - teléfonos no E.164 o con «WhatsApp fallida».
- **Validación de número** en E.164 (+57 3xx… o indicativo internacional) al cargar el Excel y al guardar celular.

## 7. Indicadores (`indicadores`)

El módulo existe; el panel aún recalcula en el cliente. Exponer `/indicadores/*` con:

- ocupación real frente a la meta de 85 %, por día de la semana (lunes y miércoles destacados), con los horarios reales del equipo;
- «Confirmado» pasadas por depurar;
- fallos por `sin_whatsapp`;
- reagendados, cupos llenados, inasistencias y abonos (las métricas de éxito de la clínica);
- reparto por los 3 especialistas, separando especialista tratante y `agendado_por`.

Cuando exista, el panel cambia el cálculo local por este endpoint.

## 8. Modo anonimizado (sustentación pública)

- `GET /panel?anonimo=true` (el panel ya lo pide en modo demo) y el mismo parámetro en `/pacientes/{id}`. Deben devolver:
  - `Paciente001…` en lugar del nombre;
  - teléfono, correo y apoderado vacíos;
  - comentarios, notas y mensajes vacíos.
- El panel ya enmascara del lado del cliente. Esto evita que los datos reales viajen al navegador durante una demo.

## 9. Catálogo de guiones

- `GET /catalogos/guiones` con las plantillas en «usted», inglés y acompañamiento de abonos. Hoy viven en `src/data/guiones.ts` y `src/lib/guiones.ts` del frontend; con el endpoint, gerencia podría editarlas sin desplegar.
