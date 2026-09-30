-- ============================================================
-- Esquema PostgreSQL del modelo Forca&Fitness
-- ============================================================
-- Este archivo es una conversión del modelo original de SQL Server.
-- Se utiliza un nombre de esquema válido para PostgreSQL y nombres en
-- snake_case para evitar identificadores con espacios o caracteres especiales.

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
    estado_alumno VARCHAR(15) NOT NULL,
    id_documento VARCHAR(10),
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
    fecha_inscripcion DATE NOT NULL,
    estado_matricula VARCHAR(9) NOT NULL,
    id_alumno VARCHAR(10),
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
    id_profesor VARCHAR(10),
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
    id_alumno VARCHAR(10),
    CONSTRAINT pk_metodo_contacto PRIMARY KEY (id_contacto),
    CONSTRAINT alumno_contacto
        FOREIGN KEY (id_alumno)
        REFERENCES academia_forca_fitness.alumno (id_alumno)
);

-- Índices para las claves foráneas consultadas con frecuencia.
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

CREATE INDEX IF NOT EXISTS idx_disciplina_nombre
    ON academia_forca_fitness.disciplina (nombre_disciplina);

CREATE INDEX IF NOT EXISTS idx_horarios_turno
    ON academia_forca_fitness.horarios (turno);

CREATE INDEX IF NOT EXISTS idx_horarios_dias
    ON academia_forca_fitness.horarios (dias);
