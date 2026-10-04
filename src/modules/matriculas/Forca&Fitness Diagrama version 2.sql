-- ============================================================
-- Esquema
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "Academia Forca&Fitness";

ALTER TABLE IF EXISTS "Academia Forca&Fitness"."Disciplina"
    ADD COLUMN IF NOT EXISTS tarifa INTEGER NOT NULL DEFAULT 150;

ALTER TABLE IF EXISTS "Academia Forca&Fitness"."Documento_Identificacion"
    ALTER COLUMN "Tipo_Documento" TYPE VARCHAR(30);

-- ============================================================
-- Disciplina
-- ============================================================
CREATE TABLE IF NOT EXISTS "Academia Forca&Fitness"."Disciplina" (
    "Id_Disciplinas" VARCHAR(10) NOT NULL,
    "Nombre_Disciplina" VARCHAR(20) NOT NULL,
    "Descripcion" VARCHAR(200) NOT NULL,
    tarifa INTEGER NOT NULL DEFAULT 150 CHECK (tarifa > 0),
    "Estado" VARCHAR(20) DEFAULT 'HABILITADO',
    CONSTRAINT pk_disciplina PRIMARY KEY ("Id_Disciplinas")
);

-- ============================================================
-- Documento de identificacion
-- ============================================================
CREATE TABLE IF NOT EXISTS "Academia Forca&Fitness"."Documento_Identificacion" (
    "Id_Documento" VARCHAR(10) NOT NULL,
    "Tipo_Documento" VARCHAR(30) NOT NULL,
    CONSTRAINT pk_documento_identificacion PRIMARY KEY ("Id_Documento")
);

INSERT INTO "Academia Forca&Fitness"."Documento_Identificacion" ("Id_Documento", "Tipo_Documento") VALUES
    ('DOC001', 'DNI'),
    ('DOC002', 'CarnÃƒÆ’Ã‚Â© de extranjerÃƒÆ’Ã‚Â­a'),
    ('DOC003', 'Pasaporte')
ON CONFLICT ("Id_Documento") DO NOTHING;

-- ============================================================
-- Profesor
-- ============================================================
CREATE TABLE IF NOT EXISTS "Academia Forca&Fitness"."Profesor" (
    "Id_Profesor" VARCHAR(10) NOT NULL,
    "Nombre" VARCHAR(40) NOT NULL,
    "Segundo_Nombre" VARCHAR(40),
    "Apellido_Paterno" VARCHAR(20) NOT NULL,
    "Apellido_Materno" VARCHAR(20) NOT NULL,
    CONSTRAINT pk_profesor PRIMARY KEY ("Id_Profesor")
);

-- ============================================================
-- Horarios
-- ============================================================
CREATE TABLE IF NOT EXISTS "Academia Forca&Fitness"."Horarios" (
    "Id_Horario" VARCHAR(10) NOT NULL,
    "Hora_Inicio" TIME NOT NULL,
    "Hora_Fin" TIME NOT NULL,
    "Turno" VARCHAR(10) NOT NULL,
    "Dias" VARCHAR(10) NOT NULL,
    CONSTRAINT pk_horarios PRIMARY KEY ("Id_Horario"),
    CONSTRAINT horarios_horas_validas CHECK ("Hora_Fin" > "Hora_Inicio")
);

-- ============================================================
-- Alumno
-- ============================================================
CREATE TABLE IF NOT EXISTS "Academia Forca&Fitness"."Alumno" (
    "Id_alumno" VARCHAR(10) NOT NULL,
    "Nombre" VARCHAR(40) NOT NULL,
    "Segundo_Nombre" VARCHAR(40),
    "Apellido_Paterno" VARCHAR(20) NOT NULL,
    "Apellido_Materno" VARCHAR(20) NOT NULL,
    "Fecha_Nacimiento" DATE NOT NULL,
    "Genero" VARCHAR(6) NOT NULL,
    "Direccion" VARCHAR(50) NOT NULL,
    "Estado_Alumno" VARCHAR(15) NOT NULL DEFAULT 'ACTIVO',
    "Id_Documento" VARCHAR(10) NOT NULL,
    "Numero_Documento" VARCHAR(10) NOT NULL,
    CONSTRAINT pk_alumno PRIMARY KEY ("Id_alumno"),
    CONSTRAINT documento_alumno
        FOREIGN KEY ("Id_Documento")
        REFERENCES "Academia Forca&Fitness"."Documento_Identificacion" ("Id_Documento")
);

-- ============================================================
-- MatrÃƒÆ’Ã‚Â­cula
-- ============================================================
CREATE TABLE IF NOT EXISTS "Academia Forca&Fitness"."Matricula" (
    "Id_Matricula" VARCHAR(10) NOT NULL,
    "Fecha_Inscripcion" DATE NOT NULL DEFAULT CURRENT_DATE,
    "Estado_Matricula" VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    "Id_alumno" VARCHAR(10) NOT NULL,
    CONSTRAINT pk_matricula PRIMARY KEY ("Id_Matricula"),
    CONSTRAINT alumno_matricula
        FOREIGN KEY ("Id_alumno")
        REFERENCES "Academia Forca&Fitness"."Alumno" ("Id_alumno")
);

-- ============================================================
-- RelaciÃƒÆ’Ã‚Â³n "Disciplina" - horario
-- ============================================================
CREATE TABLE IF NOT EXISTS "Academia Forca&Fitness"."Disciplina_Horario" (
    "Id_DiscHorario" VARCHAR(10) NOT NULL,
    "Capacidad_Max" INTEGER NOT NULL,
    "Id_Horario" VARCHAR(10) NOT NULL,
    "Id_Disciplina" VARCHAR(10) NOT NULL,
    "Id_Profesor" VARCHAR(10) NOT NULL,
    CONSTRAINT disciplina_horario_pk PRIMARY KEY ("Id_DiscHorario"),
    CONSTRAINT horarios_cupos
        FOREIGN KEY ("Id_Horario")
        REFERENCES "Academia Forca&Fitness"."Horarios" ("Id_Horario"),
    CONSTRAINT "Disciplina_Horario"
        FOREIGN KEY ("Id_Disciplina")
        REFERENCES "Academia Forca&Fitness"."Disciplina" ("Id_Disciplinas"),
    CONSTRAINT profesor_disciplina
        FOREIGN KEY ("Id_Profesor")
        REFERENCES "Academia Forca&Fitness"."Profesor" ("Id_Profesor"),
    CONSTRAINT capacidad_max_positiva CHECK ("Capacidad_Max" > 0)
);

-- ============================================================
-- Detalles de matrÃƒÆ’Ã‚Â­cula
-- ============================================================
CREATE TABLE IF NOT EXISTS "Academia Forca&Fitness"."Detalles_Matricula" (
    "Id_DetMatricula" VARCHAR(10) NOT NULL,
    "Id_Matricula" VARCHAR(10) NOT NULL,
    "Fecha_Inicio" DATE NOT NULL,
    "Fecha_Fin" DATE NOT NULL,
    "Id_DiscHorario" VARCHAR(10) NOT NULL,
    CONSTRAINT pk_detalles_matricula PRIMARY KEY ("Id_DetMatricula"),
    CONSTRAINT matricula_detalles
        FOREIGN KEY ("Id_Matricula")
        REFERENCES "Academia Forca&Fitness"."Matricula" ("Id_Matricula"),
    CONSTRAINT dis_detalle
        FOREIGN KEY ("Id_DiscHorario")
        REFERENCES "Academia Forca&Fitness"."Disciplina_Horario" ("Id_DiscHorario"),
    CONSTRAINT fechas_matricula_validas CHECK ("Fecha_Fin" >= "Fecha_Inicio")
);

-- ============================================================
-- MÃƒÆ’Ã‚Â©todos de "Contacto"
-- ============================================================
CREATE TABLE IF NOT EXISTS "Academia Forca&Fitness"."Metodo_Contacto" (
    "Id_contacto" VARCHAR(10) NOT NULL,
    "Tipo_Contacto" VARCHAR(8) NOT NULL,
    "Contacto" VARCHAR(50) NOT NULL,
    "Id_alumno" VARCHAR(10) NOT NULL,
    CONSTRAINT pk_metodo_contacto PRIMARY KEY ("Id_contacto"),
    CONSTRAINT alumno_contacto
        FOREIGN KEY ("Id_alumno")
        REFERENCES "Academia Forca&Fitness"."Alumno" ("Id_alumno")
);

-- ============================================================
-- Rol
-- ============================================================
CREATE TABLE IF NOT EXISTS "Academia Forca&Fitness"."Rol" (
    "Id_Rol" VARCHAR(10) NOT NULL,
    "Rol_Cargo" VARCHAR(20) NOT NULL,
    CONSTRAINT pk_rol PRIMARY KEY ("Id_Rol")
);

INSERT INTO "Academia Forca&Fitness"."Rol" ("Id_Rol", "Rol_Cargo") VALUES
    ('ROL01', 'DIRECTOR'),
    ('ROL02', 'TESORERO'),
    ('ROL03', 'PROFESOR'),
    ('ROL04', 'ALUMNO')
ON CONFLICT ("Id_Rol") DO NOTHING;

-- ============================================================
-- Usuario ("Id_Profesor" e "Id_alumno" opcionales: es uno u otro)
-- ============================================================
CREATE TABLE IF NOT EXISTS "Academia Forca&Fitness"."Usuario" (
    "Id_Usuario" VARCHAR(10) NOT NULL,
    "Correo" VARCHAR(60) NOT NULL,
    "Password_Hash" VARCHAR(60) NOT NULL,
    "Estado_Usuario" VARCHAR(15) NOT NULL DEFAULT 'ACTIVO',
    "Id_Rol" VARCHAR(10) NOT NULL,
    "Id_Profesor" VARCHAR(10),
    "Id_alumno" VARCHAR(10),
    CONSTRAINT pk_usuario PRIMARY KEY ("Id_Usuario"),
    CONSTRAINT uq_usuario_correo UNIQUE ("Correo"),
    CONSTRAINT rol_usuario
        FOREIGN KEY ("Id_Rol")
        REFERENCES "Academia Forca&Fitness"."Rol" ("Id_Rol"),
    CONSTRAINT profesor_usuario
        FOREIGN KEY ("Id_Profesor")
        REFERENCES "Academia Forca&Fitness"."Profesor" ("Id_Profesor"),
    CONSTRAINT alumno_usuario
        FOREIGN KEY ("Id_alumno")
        REFERENCES "Academia Forca&Fitness"."Alumno" ("Id_alumno")
);

-- ============================================================
-- MÃƒÆ’Ã‚Â©todo de "Pago"
-- ============================================================
CREATE TABLE IF NOT EXISTS "Academia Forca&Fitness"."Metodo_Pago" (
    "Id_MPago" VARCHAR(10) NOT NULL,
    "Nombre_Metodo" VARCHAR(15) NOT NULL,
    "Descripcion" VARCHAR(100) NOT NULL,
    "RPasarela" BOOLEAN NOT NULL DEFAULT FALSE,
    "Activo" BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT pk_metodo_pago PRIMARY KEY ("Id_MPago")
);

INSERT INTO "Academia Forca&Fitness"."Metodo_Pago" ("Id_MPago", "Nombre_Metodo", "Descripcion", "RPasarela", "Activo") VALUES
    ('MP01', 'Mercado Pago', 'Pago en linea con pasarela Mercado Pago', TRUE,  TRUE),
    ('MP02', 'Efectivo',     'Pago en efectivo en la academia',          FALSE, TRUE)
ON CONFLICT ("Id_MPago") DO NOTHING;

-- ============================================================
-- Pago
-- ============================================================
CREATE TABLE IF NOT EXISTS "Academia Forca&Fitness"."Pago" (
    "Id_Pago" VARCHAR(10) NOT NULL,
    "Monto" DECIMAL(10,2) NOT NULL,
    "Estado_Pago" VARCHAR(15) NOT NULL DEFAULT 'PENDIENTE',
    "Fecha_Pago" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "Id_Matricula" VARCHAR(10) NOT NULL,
    "Id_MPago" VARCHAR(10) NOT NULL,
    CONSTRAINT pk_pago PRIMARY KEY ("Id_Pago"),
    CONSTRAINT matricula_pago
        FOREIGN KEY ("Id_Matricula")
        REFERENCES "Academia Forca&Fitness"."Matricula" ("Id_Matricula"),
    CONSTRAINT metodo_pago_fk
        FOREIGN KEY ("Id_MPago")
        REFERENCES "Academia Forca&Fitness"."Metodo_Pago" ("Id_MPago")
);

-- ============================================================
-- Mercado Pago (detalle de la transacciÃƒÆ’Ã‚Â³n)
-- ============================================================
CREATE TABLE IF NOT EXISTS "Academia Forca&Fitness"."Mercado_Pago" (
    "Id_Mp_Transaccion" VARCHAR(10) NOT NULL,
    "Preference_Id" VARCHAR(255) NOT NULL,
    "Mp_Payment_Id" VARCHAR(100),
    "Referencia_Ext" VARCHAR(255) NOT NULL,
    "Fecha_Creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "Id_Pago" VARCHAR(10) NOT NULL,
    CONSTRAINT pk_mercado_pago PRIMARY KEY ("Id_Mp_Transaccion"),
    CONSTRAINT pago_mercado_pago
        FOREIGN KEY ("Id_Pago")
        REFERENCES "Academia Forca&Fitness"."Pago" ("Id_Pago")
);

-- ============================================================
-- ÃƒÆ’Ã‚Ândices para las claves forÃƒÆ’Ã‚Â¡neas
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_alumno_id_documento
    ON "Academia Forca&Fitness"."Alumno" ("Id_Documento");

CREATE INDEX IF NOT EXISTS idx_matricula_id_alumno
    ON "Academia Forca&Fitness"."Matricula" ("Id_alumno");

CREATE INDEX IF NOT EXISTS idx_disciplina_horario_id_horario
    ON "Academia Forca&Fitness"."Disciplina_Horario" ("Id_Horario");

CREATE INDEX IF NOT EXISTS idx_disciplina_horario_id_disciplina
    ON "Academia Forca&Fitness"."Disciplina_Horario" ("Id_Disciplina");

CREATE INDEX IF NOT EXISTS idx_disciplina_horario_id_profesor
    ON "Academia Forca&Fitness"."Disciplina_Horario" ("Id_Profesor");

CREATE INDEX IF NOT EXISTS idx_detalles_matricula_id_matricula
    ON "Academia Forca&Fitness"."Detalles_Matricula" ("Id_Matricula");

CREATE INDEX IF NOT EXISTS idx_detalles_matricula_id_disc_horario
    ON "Academia Forca&Fitness"."Detalles_Matricula" ("Id_DiscHorario");

CREATE INDEX IF NOT EXISTS idx_metodo_contacto_id_alumno
    ON "Academia Forca&Fitness"."Metodo_Contacto" ("Id_alumno");

CREATE INDEX IF NOT EXISTS idx_usuario_id_rol
    ON "Academia Forca&Fitness"."Usuario" ("Id_Rol");

CREATE INDEX IF NOT EXISTS idx_usuario_id_profesor
    ON "Academia Forca&Fitness"."Usuario" ("Id_Profesor");

CREATE INDEX IF NOT EXISTS idx_usuario_id_alumno
    ON "Academia Forca&Fitness"."Usuario" ("Id_alumno");

CREATE INDEX IF NOT EXISTS idx_pago_id_matricula
    ON "Academia Forca&Fitness"."Pago" ("Id_Matricula");

CREATE INDEX IF NOT EXISTS idx_pago_id_mpago
    ON "Academia Forca&Fitness"."Pago" ("Id_MPago");

CREATE UNIQUE INDEX IF NOT EXISTS uq_mercado_pago_payment_id
    ON "Academia Forca&Fitness"."Mercado_Pago" ("Mp_Payment_Id")
    WHERE "Mp_Payment_Id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pago_efectivo_pendiente_matricula
    ON "Academia Forca&Fitness"."Pago" ("Id_Matricula")
    WHERE "Id_MPago" = 'MP02' AND "Estado_Pago" = 'PENDIENTE';

CREATE INDEX IF NOT EXISTS idx_mercado_pago_id_pago
    ON "Academia Forca&Fitness"."Mercado_Pago" ("Id_Pago");

CREATE INDEX IF NOT EXISTS idx_disciplina_nombre
    ON "Academia Forca&Fitness"."Disciplina" ("Nombre_Disciplina");

CREATE INDEX IF NOT EXISTS idx_horarios_turno
    ON "Academia Forca&Fitness"."Horarios" ("Turno");

CREATE INDEX IF NOT EXISTS idx_horarios_dias
    ON "Academia Forca&Fitness"."Horarios" ("Dias");
