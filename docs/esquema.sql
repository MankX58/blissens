-- Estructura de backend/blissens.db (SQLite, modo WAL). Generado desde la base: no editar a mano.
-- Qué es cada tabla y qué valores lleva cada campo: docs/ESQUEMA.md
-- Regenerar (desde la raíz del repo):
--   python scripts/esquema.py
-- Cada conexión debe activar las llaves foráneas: PRAGMA foreign_keys = ON;

CREATE TABLE acciones_arancel (
	id_accion INTEGER NOT NULL, 
	categoria VARCHAR(150) NOT NULL, 
	codigo_accion VARCHAR(60), 
	nombre_accion VARCHAR(250) NOT NULL, 
	uco FLOAT NOT NULL, 
	precio_cop INTEGER NOT NULL, 
	nombre_arancel VARCHAR(80) NOT NULL, 
	habilitado BOOLEAN NOT NULL, 
	id_categoria INTEGER, 
	id_arancel INTEGER, 
	PRIMARY KEY (id_accion), 
	FOREIGN KEY(id_categoria) REFERENCES categorias_arancel (id_categoria), 
	FOREIGN KEY(id_arancel) REFERENCES aranceles (id_arancel)
);

CREATE TABLE account (
	id VARCHAR NOT NULL, 
	"accountId" TEXT NOT NULL, 
	"providerId" TEXT NOT NULL, 
	"userId" VARCHAR NOT NULL, 
	"accessToken" TEXT, 
	"refreshToken" TEXT, 
	"idToken" TEXT, 
	"accessTokenExpiresAt" TEXT, 
	"refreshTokenExpiresAt" TEXT, 
	scope TEXT, 
	password TEXT, 
	"createdAt" TEXT NOT NULL, 
	"updatedAt" TEXT NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY("userId") REFERENCES user (id) ON DELETE CASCADE
);

CREATE TABLE agenda_libre (
	id INTEGER NOT NULL, 
	fecha DATE NOT NULL, 
	hora VARCHAR(10) NOT NULL, 
	minutos INTEGER NOT NULL, 
	profesional VARCHAR(120) NOT NULL, 
	sillon VARCHAR(50) NOT NULL, 
	ocupado_por INTEGER, 
	asignado_el DATE, 
	estado_previo VARCHAR(30), 
	asistencia VARCHAR(20), 
	confirmado_el DATE, 
	id_profesional INTEGER, 
	id_sillon INTEGER, 
	asignado_por VARCHAR, "origen" VARCHAR(20) NOT NULL DEFAULT 'manual', "verificacion" VARCHAR(10), 
	PRIMARY KEY (id), 
	FOREIGN KEY(ocupado_por) REFERENCES pacientes (numero_paciente) ON DELETE SET NULL, 
	FOREIGN KEY(id_profesional) REFERENCES profesionales (id_profesional), 
	FOREIGN KEY(id_sillon) REFERENCES sillones (id_sillon), 
	FOREIGN KEY(asignado_por) REFERENCES user (id) ON DELETE SET NULL
);

CREATE TABLE apoderados (
	id_apoderado INTEGER NOT NULL, 
	numero_identificacion VARCHAR(30), 
	nombre_completo VARCHAR(200) NOT NULL, 
	telefono VARCHAR(30), 
	celular VARCHAR(30), 
	PRIMARY KEY (id_apoderado), 
	UNIQUE (numero_identificacion)
);

CREATE TABLE aranceles (
	id_arancel INTEGER NOT NULL, 
	nombre VARCHAR(80) NOT NULL, 
	PRIMARY KEY (id_arancel), 
	UNIQUE (nombre)
);

CREATE TABLE ausencias (
	id INTEGER NOT NULL, 
	user_id VARCHAR NOT NULL, 
	desde DATE NOT NULL, 
	hasta DATE NOT NULL, 
	motivo VARCHAR(60) NOT NULL, 
	registrado_por VARCHAR, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES user (id) ON DELETE CASCADE, 
	FOREIGN KEY(registrado_por) REFERENCES user (id) ON DELETE SET NULL
);

CREATE TABLE campanas (
	id INTEGER NOT NULL, 
	nombre VARCHAR(180) NOT NULL, 
	audiencia VARCHAR(120) NOT NULL, 
	plantilla TEXT NOT NULL, 
	creada_el DATETIME NOT NULL, 
	inicio DATETIME NOT NULL, 
	ritmo_seg INTEGER NOT NULL, 
	canal VARCHAR(20) NOT NULL, 
	estado VARCHAR(20) NOT NULL, 
	registrado_por VARCHAR, 
	PRIMARY KEY (id), 
	FOREIGN KEY(registrado_por) REFERENCES user (id) ON DELETE SET NULL
);

CREATE TABLE cargas_excel (
	id INTEGER NOT NULL, 
	fecha_carga DATETIME NOT NULL, 
	duracion_ms INTEGER NOT NULL, 
	total_citas INTEGER NOT NULL, 
	total_pacientes INTEGER NOT NULL, 
	citas_enriquecidas_octubre INTEGER NOT NULL, 
	guiones_cargados INTEGER NOT NULL, 
	acciones_arancel_cargadas INTEGER NOT NULL, 
	estado VARCHAR(30) NOT NULL, 
	fecha_corte DATE, 
	registrado_por VARCHAR, 
	PRIMARY KEY (id), 
	FOREIGN KEY(registrado_por) REFERENCES user (id) ON DELETE SET NULL
);

CREATE TABLE categorias_arancel (
	id_categoria INTEGER NOT NULL, 
	nombre VARCHAR(150) NOT NULL, 
	PRIMARY KEY (id_categoria), 
	UNIQUE (nombre)
);

CREATE TABLE ciclos_seguimiento (
	id INTEGER NOT NULL, 
	numero_paciente INTEGER NOT NULL, 
	caso VARCHAR(30) NOT NULL, 
	fecha_evento DATE NOT NULL, 
	cierre VARCHAR(30) NOT NULL, 
	motivo VARCHAR(30) NOT NULL, 
	contactos_json TEXT NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(numero_paciente) REFERENCES pacientes (numero_paciente) ON DELETE CASCADE
);

CREATE TABLE cita_eventos (
	numero_cita INTEGER NOT NULL, 
	id_evento INTEGER NOT NULL, 
	activo BOOLEAN NOT NULL, 
	PRIMARY KEY (numero_cita, id_evento), 
	FOREIGN KEY(numero_cita) REFERENCES citas (numero_cita) ON DELETE CASCADE, 
	FOREIGN KEY(id_evento) REFERENCES eventos_cita (id_evento)
);

CREATE TABLE citas (
	numero_cita INTEGER NOT NULL, 
	numero_paciente INTEGER NOT NULL, 
	orden_fila_excel INTEGER NOT NULL, 
	sucursal VARCHAR(80) NOT NULL, 
	antiguedad_cita VARCHAR(30) NOT NULL, 
	numero_tratamiento INTEGER, 
	especialidad VARCHAR(40) NOT NULL, 
	tipo_atencion VARCHAR(40) NOT NULL, 
	profesional VARCHAR(120) NOT NULL, 
	fecha_cita DATE NOT NULL, 
	mes_cita VARCHAR(20) NOT NULL, 
	anio_cita INTEGER NOT NULL, 
	estado_actual VARCHAR(80) NOT NULL, 
	en_archivo_octubre BOOLEAN NOT NULL, 
	hora_inicio VARCHAR(16), 
	hora_fin VARCHAR(16), 
	comentario_cita TEXT, 
	sillon VARCHAR(50), 
	tipo_paciente VARCHAR(80), 
	id_profesional INTEGER, 
	id_estado INTEGER, 
	id_sucursal INTEGER, 
	id_sillon INTEGER, 
	id_usuario_agendo INTEGER, 
	motivo_atencion TEXT, 
	fecha_creacion_cita DATETIME, 
	PRIMARY KEY (numero_cita), 
	FOREIGN KEY(numero_paciente) REFERENCES pacientes (numero_paciente) ON DELETE CASCADE, 
	FOREIGN KEY(id_profesional) REFERENCES profesionales (id_profesional), 
	FOREIGN KEY(id_estado) REFERENCES estados_cita (id_estado), 
	FOREIGN KEY(id_sucursal) REFERENCES sucursales (id_sucursal), 
	FOREIGN KEY(id_sillon) REFERENCES sillones (id_sillon), 
	FOREIGN KEY(id_usuario_agendo) REFERENCES usuarios_sistema (id_usuario)
);

CREATE TABLE configuracion (
	clave VARCHAR(60) NOT NULL, 
	valor TEXT NOT NULL, 
	PRIMARY KEY (clave)
);

CREATE TABLE contactos_seguimiento (
	id INTEGER NOT NULL, 
	numero_paciente INTEGER NOT NULL, 
	fecha DATE NOT NULL, 
	paso INTEGER NOT NULL, 
	resultado VARCHAR(30) NOT NULL, 
	mensaje TEXT NOT NULL, 
	motivo VARCHAR(30) NOT NULL, 
	nota TEXT, 
	cupo_id INTEGER, 
	registrado_por VARCHAR, 
	PRIMARY KEY (id), 
	FOREIGN KEY(numero_paciente) REFERENCES pacientes (numero_paciente) ON DELETE CASCADE, 
	FOREIGN KEY(registrado_por) REFERENCES user (id) ON DELETE SET NULL
);

CREATE TABLE envios_campana (
	id INTEGER NOT NULL, 
	campana_id INTEGER NOT NULL, 
	numero_paciente INTEGER NOT NULL, 
	nombre_paciente VARCHAR(200) NOT NULL, 
	telefono VARCHAR(30) NOT NULL, 
	texto TEXT NOT NULL, 
	estado VARCHAR(20) NOT NULL, 
	fecha_envio DATETIME, 
	error TEXT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(campana_id) REFERENCES campanas (id) ON DELETE CASCADE, 
	FOREIGN KEY(numero_paciente) REFERENCES pacientes (numero_paciente) ON DELETE CASCADE
);

CREATE TABLE especialidades (
	id_especialidad INTEGER NOT NULL, 
	codigo VARCHAR(10) NOT NULL, 
	descripcion VARCHAR(120), 
	PRIMARY KEY (id_especialidad), 
	UNIQUE (codigo)
);

CREATE TABLE estados_cita (
	id_estado INTEGER NOT NULL, 
	nombre VARCHAR(80) NOT NULL, 
	es_atendida BOOLEAN NOT NULL, 
	es_friccion BOOLEAN NOT NULL, 
	es_friccion_kpi BOOLEAN NOT NULL, 
	cuenta_como_fallo BOOLEAN NOT NULL, 
	es_confirmacion BOOLEAN NOT NULL, 
	PRIMARY KEY (id_estado), 
	UNIQUE (nombre)
);

CREATE TABLE etiquetas_paciente (
	numero_paciente INTEGER NOT NULL, 
	etiqueta VARCHAR(40) NOT NULL, 
	PRIMARY KEY (numero_paciente, etiqueta), 
	FOREIGN KEY(numero_paciente) REFERENCES pacientes (numero_paciente) ON DELETE CASCADE
);

CREATE TABLE eventos_cita (
	id_evento INTEGER NOT NULL, 
	codigo VARCHAR(60) NOT NULL, 
	descripcion VARCHAR(120) NOT NULL, 
	PRIMARY KEY (id_evento), 
	UNIQUE (codigo)
);

CREATE TABLE guiones (
	id INTEGER NOT NULL, 
	fila_excel INTEGER NOT NULL, 
	categoria VARCHAR(120) NOT NULL, 
	situacion VARCHAR(180) NOT NULL, 
	mensaje_plantilla TEXT NOT NULL, 
	notas_equipo TEXT, 
	variables_json TEXT NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE horarios_profesional (
	id INTEGER NOT NULL, 
	profesional VARCHAR(120) NOT NULL, 
	dia_semana INTEGER NOT NULL, 
	inicio VARCHAR(5) NOT NULL, 
	fin VARCHAR(5) NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE notas_paciente (
	id INTEGER NOT NULL, 
	numero_paciente INTEGER NOT NULL, 
	fecha DATE NOT NULL, 
	texto TEXT NOT NULL, 
	registrado_por VARCHAR, 
	PRIMARY KEY (id), 
	FOREIGN KEY(numero_paciente) REFERENCES pacientes (numero_paciente) ON DELETE CASCADE, 
	FOREIGN KEY(registrado_por) REFERENCES user (id) ON DELETE SET NULL
);

CREATE TABLE ofertas_cupo (
	id INTEGER NOT NULL, 
	cupo_id INTEGER NOT NULL, 
	numero_paciente INTEGER NOT NULL, 
	fecha DATE NOT NULL, 
	rechazo BOOLEAN NOT NULL, 
	registrado_por VARCHAR, 
	PRIMARY KEY (id), 
	FOREIGN KEY(cupo_id) REFERENCES agenda_libre (id) ON DELETE CASCADE, 
	FOREIGN KEY(numero_paciente) REFERENCES pacientes (numero_paciente) ON DELETE CASCADE, 
	FOREIGN KEY(registrado_por) REFERENCES user (id) ON DELETE SET NULL
);

CREATE TABLE pacientes (
	numero_paciente INTEGER NOT NULL, 
	nombre_completo VARCHAR(200) NOT NULL, 
	antiguedad_actual VARCHAR(20) NOT NULL, 
	ingreso_como_nuevo BOOLEAN NOT NULL, 
	segmento_cartera VARCHAR(30) NOT NULL, 
	perfil_comercial VARCHAR(30) NOT NULL, 
	caso_seguimiento VARCHAR(30), 
	estado_seguimiento VARCHAR(30) NOT NULL, 
	motivo_cancelacion VARCHAR(30) NOT NULL, 
	profesional_principal VARCHAR(120) NOT NULL, 
	ultima_fecha_cita DATE NOT NULL, 
	ultimo_estado_cita VARCHAR(80) NOT NULL, 
	ultimo_comentario TEXT, 
	tipo_paciente VARCHAR(80), 
	telefono_normalizado VARCHAR(30), 
	email VARCHAR(180), 
	apoderado VARCHAR(200), 
	tiene_ficha_contacto BOOLEAN NOT NULL, 
	sin_celular BOOLEAN NOT NULL, 
	estado_contacto VARCHAR(40) NOT NULL, 
	fuente_telefono VARCHAR(30), 
	tratamientos_atendidos INTEGER NOT NULL, 
	diagnosticos_atendidos INTEGER NOT NULL, 
	fallos_historicos INTEGER NOT NULL, 
	fallos_seguidos INTEGER NOT NULL, 
	ultima_atendida DATE, 
	score_riesgo INTEGER NOT NULL, 
	nivel_riesgo VARCHAR(20) NOT NULL, 
	requiere_doble_confirmacion BOOLEAN NOT NULL, 
	es_vip BOOLEAN NOT NULL, 
	es_control_limpieza BOOLEAN NOT NULL, 
	pausa_mayor_30_dias BOOLEAN NOT NULL, 
	dias_desde_evento INTEGER NOT NULL, 
	fecha_evento DATE, 
	semaforo VARCHAR(20), 
	paso_protocolo_actual INTEGER, 
	fecha_proximo_contacto DATE, 
	toca_hoy BOOLEAN NOT NULL, 
	valor_estimado_cop INTEGER NOT NULL, 
	valor_estimado_fuente VARCHAR(50) NOT NULL, 
	accion_arancel_referencia VARCHAR(200), 
	recuperado_el DATE, 
	origen VARCHAR(20) NOT NULL, 
	creado_el DATE NOT NULL, 
	nombres VARCHAR(100), 
	apellidos VARCHAR(100), 
	numero_identificacion VARCHAR(30), 
	numero_interno VARCHAR(30), 
	fecha_nacimiento DATE, 
	telefono_secundario VARCHAR(30), 
	convenio_paciente VARCHAR(80), 
	observaciones_medicas TEXT, 
	habilitado BOOLEAN NOT NULL, 
	id_apoderado INTEGER, 
	total_citas INTEGER NOT NULL, 
	total_atendidas INTEGER NOT NULL, 
	numero_ultima_cita INTEGER, "motivo_vip" VARCHAR(80), 
	PRIMARY KEY (numero_paciente), 
	FOREIGN KEY(id_apoderado) REFERENCES apoderados (id_apoderado) ON DELETE SET NULL
);

CREATE TABLE pausas_agenda (
	id INTEGER NOT NULL, 
	nombre VARCHAR(60) NOT NULL, 
	inicio VARCHAR(5) NOT NULL, 
	fin VARCHAR(5) NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE profesionales (
	id_profesional INTEGER NOT NULL, 
	nombre_mostrar VARCHAR(120) NOT NULL, 
	nombres VARCHAR(80) NOT NULL, 
	apellidos VARCHAR(80) NOT NULL, 
	id_especialidad INTEGER NOT NULL, 
	activo BOOLEAN NOT NULL, 
	PRIMARY KEY (id_profesional), 
	UNIQUE (nombre_mostrar), 
	FOREIGN KEY(id_especialidad) REFERENCES especialidades (id_especialidad)
);

CREATE TABLE session (
	id VARCHAR NOT NULL, 
	"expiresAt" TEXT NOT NULL, 
	token VARCHAR NOT NULL, 
	"createdAt" TEXT NOT NULL, 
	"updatedAt" TEXT NOT NULL, 
	"ipAddress" TEXT, 
	"userAgent" TEXT, 
	"userId" VARCHAR NOT NULL, 
	"impersonatedBy" TEXT, 
	PRIMARY KEY (id), 
	UNIQUE (token), 
	FOREIGN KEY("userId") REFERENCES user (id) ON DELETE CASCADE
);

CREATE TABLE sillones (
	id_sillon INTEGER NOT NULL, 
	id_sucursal INTEGER NOT NULL, 
	nombre VARCHAR(50) NOT NULL, 
	activo BOOLEAN NOT NULL, 
	PRIMARY KEY (id_sillon), 
	UNIQUE (id_sucursal, nombre), 
	FOREIGN KEY(id_sucursal) REFERENCES sucursales (id_sucursal)
);

CREATE TABLE sucursales (
	id_sucursal INTEGER NOT NULL, 
	nombre VARCHAR(80) NOT NULL, 
	direccion VARCHAR(200), 
	PRIMARY KEY (id_sucursal), 
	UNIQUE (nombre)
);

CREATE TABLE tratamientos (
	numero_tratamiento INTEGER NOT NULL, 
	numero_paciente INTEGER NOT NULL, 
	id_especialidad INTEGER NOT NULL, 
	tipo_atencion VARCHAR(20) NOT NULL, 
	convenio_tratamiento VARCHAR(80), 
	fecha_generacion DATE, 
	PRIMARY KEY (numero_tratamiento), 
	FOREIGN KEY(numero_paciente) REFERENCES pacientes (numero_paciente) ON DELETE CASCADE, 
	FOREIGN KEY(id_especialidad) REFERENCES especialidades (id_especialidad)
);

CREATE TABLE user (
	id VARCHAR NOT NULL, 
	name TEXT NOT NULL, 
	email VARCHAR NOT NULL, 
	"emailVerified" INTEGER NOT NULL, 
	image TEXT, 
	"createdAt" TEXT NOT NULL, 
	"updatedAt" TEXT NOT NULL, 
	role TEXT, 
	banned INTEGER, 
	"banReason" TEXT, 
	"banExpires" TEXT, 
	profesional TEXT, 
	PRIMARY KEY (id), 
	UNIQUE (email)
);

CREATE TABLE usuarios_sistema (
	id_usuario INTEGER NOT NULL, 
	nombre_usuario VARCHAR(80) NOT NULL, 
	PRIMARY KEY (id_usuario), 
	UNIQUE (nombre_usuario)
);

CREATE TABLE verification (
	id VARCHAR NOT NULL, 
	identifier TEXT NOT NULL, 
	value TEXT NOT NULL, 
	"expiresAt" TEXT NOT NULL, 
	"createdAt" TEXT NOT NULL, 
	"updatedAt" TEXT NOT NULL, 
	PRIMARY KEY (id)
);

CREATE INDEX ix_acciones_arancel_categoria ON acciones_arancel (categoria);

CREATE INDEX ix_acciones_arancel_habilitado ON acciones_arancel (habilitado);

CREATE INDEX ix_acciones_arancel_nombre_accion ON acciones_arancel (nombre_accion);

CREATE INDEX "ix_account_userId" ON account ("userId");

CREATE INDEX ix_agenda_libre_fecha ON agenda_libre (fecha);

CREATE INDEX ix_agenda_libre_ocupado_por ON agenda_libre (ocupado_por);

CREATE INDEX ix_agenda_libre_profesional ON agenda_libre (profesional);

CREATE INDEX ix_ausencias_user_id ON ausencias (user_id);

CREATE INDEX ix_campanas_estado ON campanas (estado);

CREATE INDEX ix_ciclos_seguimiento_numero_paciente ON ciclos_seguimiento (numero_paciente);

CREATE INDEX ix_citas_estado_actual ON citas (estado_actual);

CREATE INDEX ix_citas_fecha_cita ON citas (fecha_cita);

CREATE INDEX ix_citas_mes_cita ON citas (mes_cita);

CREATE INDEX ix_citas_numero_paciente ON citas (numero_paciente);

CREATE INDEX ix_citas_orden_fila_excel ON citas (orden_fila_excel);

CREATE INDEX ix_citas_profesional ON citas (profesional);

CREATE INDEX ix_citas_tipo_atencion ON citas (tipo_atencion);

CREATE INDEX ix_contactos_seguimiento_fecha ON contactos_seguimiento (fecha);

CREATE INDEX ix_contactos_seguimiento_numero_paciente ON contactos_seguimiento (numero_paciente);

CREATE INDEX ix_envios_campana_campana_id ON envios_campana (campana_id);

CREATE INDEX ix_envios_campana_estado ON envios_campana (estado);

CREATE INDEX ix_envios_campana_numero_paciente ON envios_campana (numero_paciente);

CREATE INDEX ix_guiones_categoria ON guiones (categoria);

CREATE UNIQUE INDEX ix_guiones_fila_excel ON guiones (fila_excel);

CREATE INDEX ix_horarios_profesional_profesional ON horarios_profesional (profesional);

CREATE INDEX ix_notas_paciente_numero_paciente ON notas_paciente (numero_paciente);

CREATE INDEX ix_ofertas_cupo_cupo_id ON ofertas_cupo (cupo_id);

CREATE INDEX ix_ofertas_cupo_numero_paciente ON ofertas_cupo (numero_paciente);

CREATE INDEX ix_pacientes_es_control_limpieza ON pacientes (es_control_limpieza);

CREATE INDEX ix_pacientes_es_vip ON pacientes (es_vip);

CREATE INDEX ix_pacientes_estado_contacto ON pacientes (estado_contacto);

CREATE INDEX ix_pacientes_estado_seguimiento ON pacientes (estado_seguimiento);

CREATE INDEX ix_pacientes_nivel_riesgo ON pacientes (nivel_riesgo);

CREATE INDEX ix_pacientes_nombre_completo ON pacientes (nombre_completo);

CREATE INDEX ix_pacientes_profesional_principal ON pacientes (profesional_principal);

CREATE INDEX ix_pacientes_segmento_cartera ON pacientes (segmento_cartera);

CREATE INDEX ix_pacientes_semaforo ON pacientes (semaforo);

CREATE INDEX ix_pacientes_toca_hoy ON pacientes (toca_hoy);

CREATE INDEX "ix_session_userId" ON session ("userId");

CREATE INDEX ix_tratamientos_numero_paciente ON tratamientos (numero_paciente);

CREATE INDEX ix_verification_identifier ON verification (identifier);
