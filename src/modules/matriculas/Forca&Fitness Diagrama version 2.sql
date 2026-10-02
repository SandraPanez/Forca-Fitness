-- ============================================================
-- Esquema
-- ============================================================
CREATE SCHEMA IF NOT EXISTS academia_forca_fitness;

-- ============================================================
-- Disciplina
-- ============================================================
CREATE TABLE IF NOT EXISTS academia_forca_fitness.disciplina (
    id_disciplina VARCHAR(10) NOT NULL,
    nombre_disciplina VARCHAR(20) NOT NULL,
    descripcion VARCHAR(200) NOT NULL,
    CONSTRAINT pk_disciplina PRIMARY KEY (id_disciplina)
);

-- ============================================================
-- Documento de identificación
-- ============================================================
CREATE TABLE IF NOT EXISTS academia_forca_fitness.documento_identificacion (
    id_documento VARCHAR(10) NOT NULL,
    tipo_documento VARCHAR(20) NOT NULL,
    CONSTRAINT pk_documento_identificacion PRIMARY KEY (id_documento)
);

INSERT INTO academia_forca_fitness.documento_identificacion (id_documento, tipo_documento) VALUES
    ('DOC001', 'DNI'),
    ('DOC002', 'Carné de extranjería'),
    ('DOC003', 'Pasaporte')
ON CONFLICT (id_documento) DO NOTHING;

-- ============================================================
-- Profesor
-- ============================================================
CREATE TABLE IF NOT EXISTS academia_forca_fitness.profesor (
    id_profesor VARCHAR(10) NOT NULL,
    nombre VARCHAR(40) NOT NULL,
    segundo_nombre VARCHAR(40),
    apellido_paterno VARCHAR(20) NOT NULL,
    apellido_materno VARCHAR(20) NOT NULL,
    CONSTRAINT pk_profesor PRIMARY KEY (id_profesor)
);

-- ============================================================
-- Horarios
-- ============================================================
CREATE TABLE IF NOT EXISTS academia_forca_fitness.horarios (
    id_horario VARCHAR(10) NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    turno VARCHAR(10) NOT NULL,
    dias VARCHAR(10) NOT NULL,
    CONSTRAINT pk_horarios PRIMARY KEY (id_horario),
    CONSTRAINT horarios_horas_validas CHECK (hora_fin > hora_inicio)
);

-- ============================================================
-- Alumno
-- ============================================================
CREATE TABLE IF NOT EXISTS academia_forca_fitness.alumno (
    id_alumno VARCHAR(10) NOT NULL,
    nombre VARCHAR(40) NOT NULL,
    segundo_nombre VARCHAR(40),
    apellido_paterno VARCHAR(20) NOT NULL,
    apellido_materno VARCHAR(20) NOT NULL,
    fecha_nacimiento DATE NOT NULL,
    genero VARCHAR(6) NOT NULL,
    direccion VARCHAR(50) NOT NULL,
    estado_alumno VARCHAR(15) NOT NULL DEFAULT 'ACTIVO',
    id_documento VARCHAR(10) NOT NULL,
    numero_documento VARCHAR(10) NOT NULL,
    CONSTRAINT pk_alumno PRIMARY KEY (id_alumno),
    CONSTRAINT documento_alumno
        FOREIGN KEY (id_documento)
        REFERENCES academia_forca_fitness.documento_identificacion (id_documento)
);

-- ============================================================
-- Matrícula
-- ============================================================
CREATE TABLE IF NOT EXISTS academia_forca_fitness.matricula (
    id_matricula VARCHAR(10) NOT NULL,
    fecha_inscripcion DATE NOT NULL DEFAULT CURRENT_DATE,
    estado_matricula VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    id_alumno VARCHAR(10) NOT NULL,
    CONSTRAINT pk_matricula PRIMARY KEY (id_matricula),
    CONSTRAINT alumno_matricula
        FOREIGN KEY (id_alumno)
        REFERENCES academia_forca_fitness.alumno (id_alumno)
);

-- ============================================================
-- Relación disciplina - horario
-- ============================================================
CREATE TABLE IF NOT EXISTS academia_forca_fitness.disciplina_horario (
    id_disc_horario VARCHAR(10) NOT NULL,
    capacidad_max INTEGER NOT NULL,
    id_horario VARCHAR(10) NOT NULL,
    id_disciplina VARCHAR(10) NOT NULL,
    id_profesor VARCHAR(10) NOT NULL,
    CONSTRAINT disciplina_horario_pk PRIMARY KEY (id_disc_horario),
    CONSTRAINT horarios_cupos
        FOREIGN KEY (id_horario)
        REFERENCES academia_forca_fitness.horarios (id_horario),
    CONSTRAINT disciplina_horario
        FOREIGN KEY (id_disciplina)
        REFERENCES academia_forca_fitness.disciplina (id_disciplina),
    CONSTRAINT profesor_disciplina
        FOREIGN KEY (id_profesor)
        REFERENCES academia_forca_fitness.profesor (id_profesor),
    CONSTRAINT capacidad_max_positiva CHECK (capacidad_max > 0)
);

-- ============================================================
-- Detalles de matrícula
-- ============================================================
CREATE TABLE IF NOT EXISTS academia_forca_fitness.detalles_matricula (
    id_det_matricula VARCHAR(10) NOT NULL,
    id_matricula VARCHAR(10) NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    id_disc_horario VARCHAR(10) NOT NULL,
    CONSTRAINT pk_detalles_matricula PRIMARY KEY (id_det_matricula),
    CONSTRAINT matricula_detalles
        FOREIGN KEY (id_matricula)
        REFERENCES academia_forca_fitness.matricula (id_matricula),
    CONSTRAINT dis_detalle
        FOREIGN KEY (id_disc_horario)
        REFERENCES academia_forca_fitness.disciplina_horario (id_disc_horario),
    CONSTRAINT fechas_matricula_validas CHECK (fecha_fin >= fecha_inicio)
);

-- ============================================================
-- Métodos de contacto
-- ============================================================
CREATE TABLE IF NOT EXISTS academia_forca_fitness.metodo_contacto (
    id_contacto VARCHAR(10) NOT NULL,
    tipo_contacto VARCHAR(8) NOT NULL,
    contacto VARCHAR(50) NOT NULL,
    id_alumno VARCHAR(10) NOT NULL,
    CONSTRAINT pk_metodo_contacto PRIMARY KEY (id_contacto),
    CONSTRAINT alumno_contacto
        FOREIGN KEY (id_alumno)
        REFERENCES academia_forca_fitness.alumno (id_alumno)
);

-- ============================================================
-- Rol
-- ============================================================
CREATE TABLE IF NOT EXISTS academia_forca_fitness.rol (
    id_rol VARCHAR(10) NOT NULL,
    rol_cargo VARCHAR(20) NOT NULL,
    CONSTRAINT pk_rol PRIMARY KEY (id_rol)
);

INSERT INTO academia_forca_fitness.rol (id_rol, rol_cargo) VALUES
    ('ROL001', 'ADMIN'),
    ('ROL002', 'PROFESOR'),
    ('ROL003', 'ALUMNO')
ON CONFLICT (id_rol) DO NOTHING;

-- ============================================================
-- Usuario (id_profesor e id_alumno opcionales: es uno u otro)
-- ============================================================
CREATE TABLE IF NOT EXISTS academia_forca_fitness.usuario (
    id_usuario VARCHAR(10) NOT NULL,
    correo VARCHAR(60) NOT NULL,
    password_hash VARCHAR(60) NOT NULL,
    estado_usuario VARCHAR(15) NOT NULL DEFAULT 'ACTIVO',
    id_rol VARCHAR(10) NOT NULL,
    id_profesor VARCHAR(10),
    id_alumno VARCHAR(10),
    CONSTRAINT pk_usuario PRIMARY KEY (id_usuario),
    CONSTRAINT uq_usuario_correo UNIQUE (correo),
    CONSTRAINT rol_usuario
        FOREIGN KEY (id_rol)
        REFERENCES academia_forca_fitness.rol (id_rol),
    CONSTRAINT profesor_usuario
        FOREIGN KEY (id_profesor)
        REFERENCES academia_forca_fitness.profesor (id_profesor),
    CONSTRAINT alumno_usuario
        FOREIGN KEY (id_alumno)
        REFERENCES academia_forca_fitness.alumno (id_alumno)
);

-- ============================================================
-- Método de pago
-- ============================================================
CREATE TABLE IF NOT EXISTS academia_forca_fitness.metodo_pago (
    id_mpago VARCHAR(10) NOT NULL,
    nombre_metodo VARCHAR(15) NOT NULL,
    descripcion VARCHAR(100) NOT NULL,
    rpasarela BOOLEAN NOT NULL DEFAULT FALSE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT pk_metodo_pago PRIMARY KEY (id_mpago)
);

INSERT INTO academia_forca_fitness.metodo_pago (id_mpago, nombre_metodo, descripcion, rpasarela, activo) VALUES
    ('MP001', 'Mercado Pago', 'Pago en línea con pasarela Mercado Pago', TRUE,  TRUE),
    ('MP002', 'Efectivo',     'Pago en efectivo en la academia',          FALSE, TRUE)
ON CONFLICT (id_mpago) DO NOTHING;

-- ============================================================
-- Pago
-- ============================================================
CREATE TABLE IF NOT EXISTS academia_forca_fitness.pago (
    id_pago VARCHAR(10) NOT NULL,
    monto DECIMAL(10,2) NOT NULL,
    estado_pago VARCHAR(15) NOT NULL DEFAULT 'PENDIENTE',
    fecha_pago TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_matricula VARCHAR(10) NOT NULL,
    id_mpago VARCHAR(10) NOT NULL,
    CONSTRAINT pk_pago PRIMARY KEY (id_pago),
    CONSTRAINT matricula_pago
        FOREIGN KEY (id_matricula)
        REFERENCES academia_forca_fitness.matricula (id_matricula),
    CONSTRAINT metodo_pago_fk
        FOREIGN KEY (id_mpago)
        REFERENCES academia_forca_fitness.metodo_pago (id_mpago)
);

-- ============================================================
-- Mercado Pago (detalle de la transacción)
-- ============================================================
CREATE TABLE IF NOT EXISTS academia_forca_fitness.mercado_pago (
    id_mp_transaccion VARCHAR(10) NOT NULL,
    preference_id VARCHAR(255) NOT NULL,
    mp_payment_id VARCHAR(100),
    referencia_ext VARCHAR(255) NOT NULL,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_pago VARCHAR(10) NOT NULL,
    CONSTRAINT pk_mercado_pago PRIMARY KEY (id_mp_transaccion),
    CONSTRAINT pago_mercado_pago
        FOREIGN KEY (id_pago)
        REFERENCES academia_forca_fitness.pago (id_pago)
);

-- ============================================================
-- Índices para las claves foráneas
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_alumno_id_documento
    ON academia_forca_fitness.alumno (id_documento);

CREATE INDEX IF NOT EXISTS idx_matricula_id_alumno
    ON academia_forca_fitness.matricula (id_alumno);

CREATE INDEX IF NOT EXISTS idx_disciplina_horario_id_horario
    ON academia_forca_fitness.disciplina_horario (id_horario);

CREATE INDEX IF NOT EXISTS idx_disciplina_horario_id_disciplina
    ON academia_forca_fitness.disciplina_horario (id_disciplina);

CREATE INDEX IF NOT EXISTS idx_disciplina_horario_id_profesor
    ON academia_forca_fitness.disciplina_horario (id_profesor);

CREATE INDEX IF NOT EXISTS idx_detalles_matricula_id_matricula
    ON academia_forca_fitness.detalles_matricula (id_matricula);

CREATE INDEX IF NOT EXISTS idx_detalles_matricula_id_disc_horario
    ON academia_forca_fitness.detalles_matricula (id_disc_horario);

CREATE INDEX IF NOT EXISTS idx_metodo_contacto_id_alumno
    ON academia_forca_fitness.metodo_contacto (id_alumno);

CREATE INDEX IF NOT EXISTS idx_usuario_id_rol
    ON academia_forca_fitness.usuario (id_rol);

CREATE INDEX IF NOT EXISTS idx_usuario_id_profesor
    ON academia_forca_fitness.usuario (id_profesor);

CREATE INDEX IF NOT EXISTS idx_usuario_id_alumno
    ON academia_forca_fitness.usuario (id_alumno);

CREATE INDEX IF NOT EXISTS idx_pago_id_matricula
    ON academia_forca_fitness.pago (id_matricula);

CREATE INDEX IF NOT EXISTS idx_pago_id_mpago
    ON academia_forca_fitness.pago (id_mpago);

CREATE INDEX IF NOT EXISTS idx_mercado_pago_id_pago
    ON academia_forca_fitness.mercado_pago (id_pago);