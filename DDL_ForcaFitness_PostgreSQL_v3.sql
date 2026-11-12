-- ============================================================================
-- PROYECTO: FORCA & FITNESS
-- SCRIPT: DDL & DML CONVERSIÓN A POSTGRESQL (VERSION 3.0 RELACIONAL)
-- DESCRIPCIÓN: 
-- 1. Conversión de tipos de datos de Sybase / SQL Server a PostgreSQL estándar.
-- 2. Creación del esquema relacional de 17 tablas con integridad referencial.
-- 3. Inserción de datos extraídos de 'DDL Forca&Fitness (Version 3.0).sql' adaptados
--    a la arquitectura normalizada con la entidad padre 'Persona'.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. CREACIÓN Y CONFIGURACIÓN DEL ESQUEMA
-- ----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS "Academia Forca&Fitness";
SET search_path TO "Academia Forca&Fitness", public;

-- ============================================================================
-- PARTE 1: DEFINICIÓN DE TABLAS (DDL)
-- ============================================================================

-- ****************************************************
-- * 1. Documento_Identificacion                      *
-- ****************************************************
CREATE TABLE IF NOT EXISTS "Documento_Identificacion" (
    "Id_Documento"   VARCHAR(10) NOT NULL,
    "Tipo_Documento" VARCHAR(20) NOT NULL,
    CONSTRAINT "PK_Documento_Identificacion" PRIMARY KEY ("Id_Documento")
);

-- ****************************************************
-- * 2. Disciplina                                    *
-- ****************************************************
CREATE TABLE IF NOT EXISTS "Disciplina" (
    "Id_Disciplinas"    VARCHAR(10)   NOT NULL,
    "Nombre_Disciplina" VARCHAR(50)   NOT NULL,
    "Descripcion"       VARCHAR(200)  NOT NULL,
    "Tarifa"            DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    CONSTRAINT "PK_Disciplina" PRIMARY KEY ("Id_Disciplinas")
);

-- ****************************************************
-- * 3. Horarios                                      *
-- ****************************************************
CREATE TABLE IF NOT EXISTS "Horarios" (
    "Id_Horario"  VARCHAR(10) NOT NULL,
    "Hora_Inicio" TIME        NOT NULL,
    "Hora_Fin"    TIME        NOT NULL,
    "Turno"       VARCHAR(10) NOT NULL,
    "Dias"        VARCHAR(20) NOT NULL,
    CONSTRAINT "PK_Horarios" PRIMARY KEY ("Id_Horario")
);

-- ****************************************************
-- * 4. Rol                                           *
-- ****************************************************
CREATE TABLE IF NOT EXISTS "Rol" (
    "Id_Rol"    VARCHAR(10) NOT NULL,
    "Rol_Cargo" VARCHAR(20) NOT NULL,
    CONSTRAINT "PK_Rol" PRIMARY KEY ("Id_Rol"),
    CONSTRAINT "UQ_Rol_Cargo" UNIQUE ("Rol_Cargo")
);

-- ****************************************************
-- * 5. Metodo_Pago                                   *
-- ****************************************************
CREATE TABLE IF NOT EXISTS "Metodo_Pago" (
    "Id_MPago"      VARCHAR(10)  NOT NULL,
    "Nombre_Metodo" VARCHAR(20)  NOT NULL,
    "Descripcion"   VARCHAR(100) NULL,
    "RPasarela"     BOOLEAN      NOT NULL DEFAULT FALSE,
    "Activo"        BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT "PK_Metodo_Pago" PRIMARY KEY ("Id_MPago"),
    CONSTRAINT "UQ_Metodo_Pago_Nombre" UNIQUE ("Nombre_Metodo")
);

-- ****************************************************
-- * 6. Persona (Superentidad Central)                *
-- ****************************************************
CREATE TABLE IF NOT EXISTS "Persona" (
    "Id_Persona"       VARCHAR(10) NOT NULL,
    "Nombre"           VARCHAR(40) NOT NULL,
    "Segundo_Nombre"   VARCHAR(40) NULL,
    "Apellido_Paterno" VARCHAR(20) NOT NULL,
    "Apellido_Materno" VARCHAR(20) NOT NULL,
    "Fecha_Nacimiento" DATE        NOT NULL,
    "Genero"           VARCHAR(6)  NOT NULL,
    "Direccion"        VARCHAR(50) NOT NULL,
    "Numero_Documento" VARCHAR(10) NOT NULL,
    "Id_Documento"     VARCHAR(10) NULL,
    CONSTRAINT "PK_Persona" PRIMARY KEY ("Id_Persona"),
    CONSTRAINT "FK_Persona_Documento" FOREIGN KEY ("Id_Documento") 
        REFERENCES "Documento_Identificacion" ("Id_Documento")
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- ****************************************************
-- * 7. Profesor                                      *
-- ****************************************************
CREATE TABLE IF NOT EXISTS "Profesor" (
    "Id_Profesor" VARCHAR(10)  NOT NULL,
    "Id_Persona"  VARCHAR(10)  NOT NULL,
    "Grado_Rango" VARCHAR(30)  NULL,
    "Biografia"   VARCHAR(200) NULL,
    CONSTRAINT "PK_Profesor" PRIMARY KEY ("Id_Profesor"),
    CONSTRAINT "UQ_Profesor_Persona" UNIQUE ("Id_Persona"),
    CONSTRAINT "FK_Profesor_Persona" FOREIGN KEY ("Id_Persona") 
        REFERENCES "Persona" ("Id_Persona")
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- ****************************************************
-- * 8. Alumno                                        *
-- ****************************************************
CREATE TABLE IF NOT EXISTS "Alumno" (
    "Id_alumno"     VARCHAR(10)  NOT NULL,
    "Estado_Alumno" VARCHAR(15)  NOT NULL DEFAULT 'Activo',
    "Condicion"     VARCHAR(200) NOT NULL DEFAULT 'Ninguna',
    "Id_Persona"    VARCHAR(10)  NOT NULL,
    CONSTRAINT "PK_Alumno" PRIMARY KEY ("Id_alumno"),
    CONSTRAINT "UQ_Alumno_Persona" UNIQUE ("Id_Persona"),
    CONSTRAINT "FK_Alumno_Persona" FOREIGN KEY ("Id_Persona") 
        REFERENCES "Persona" ("Id_Persona")
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- ****************************************************
-- * 9. Metodo_Contacto                               *
-- ****************************************************
CREATE TABLE IF NOT EXISTS "Metodo_Contacto" (
    "Id_contacto"   VARCHAR(10) NOT NULL,
    "Tipo_Contacto" VARCHAR(20) NOT NULL,
    "Contacto"      VARCHAR(50) NOT NULL,
    "Id_Persona"    VARCHAR(10) NOT NULL,
    CONSTRAINT "PK_Metodo_Contacto" PRIMARY KEY ("Id_contacto"),
    CONSTRAINT "FK_Contacto_Persona" FOREIGN KEY ("Id_Persona") 
        REFERENCES "Persona" ("Id_Persona")
        ON UPDATE CASCADE ON DELETE CASCADE
);

-- ****************************************************
-- * 10. Usuario                                      *
-- ****************************************************
CREATE TABLE IF NOT EXISTS "Usuario" (
    "Id_Usuario"     VARCHAR(10)  NOT NULL,
    "Correo"         VARCHAR(100) NOT NULL,
    "Password_Hash"  VARCHAR(255) NOT NULL,
    "Estado_Usuario" VARCHAR(15)  NOT NULL DEFAULT 'Activo',
    "Id_Persona"     VARCHAR(10)  NULL,
    CONSTRAINT "PK_Usuario" PRIMARY KEY ("Id_Usuario"),
    CONSTRAINT "UQ_Usuario_Correo" UNIQUE ("Correo"),
    CONSTRAINT "UQ_Usuario_Persona" UNIQUE ("Id_Persona"),
    CONSTRAINT "FK_Usuario_Persona" FOREIGN KEY ("Id_Persona") 
        REFERENCES "Persona" ("Id_Persona")
        ON UPDATE CASCADE ON DELETE SET NULL
);

-- ****************************************************
-- * 11. Usuario_Rol                                  *
-- ****************************************************
CREATE TABLE IF NOT EXISTS "Usuario_Rol" (
    "Id_Usuario" VARCHAR(10) NOT NULL,
    "Id_Rol"     VARCHAR(10) NOT NULL,
    CONSTRAINT "PK_Usuario_Rol" PRIMARY KEY ("Id_Usuario", "Id_Rol"),
    CONSTRAINT "FK_UsuarioRol_Usuario" FOREIGN KEY ("Id_Usuario") 
        REFERENCES "Usuario" ("Id_Usuario")
        ON DELETE CASCADE,
    CONSTRAINT "FK_UsuarioRol_Rol" FOREIGN KEY ("Id_Rol") 
        REFERENCES "Rol" ("Id_Rol")
        ON DELETE CASCADE
);

-- ****************************************************
-- * 12. Disciplina_Horario                           *
-- ****************************************************
CREATE TABLE IF NOT EXISTS "Disciplina_Horario" (
    "Id_DiscHorario" VARCHAR(10) NOT NULL,
    "Capacidad_Max"  INTEGER     NOT NULL CHECK ("Capacidad_Max" > 0),
    "Id_Horario"     VARCHAR(10) NOT NULL,
    "Id_Disciplina"  VARCHAR(10) NOT NULL,
    "Id_Profesor"    VARCHAR(10) NOT NULL,
    CONSTRAINT "PK_Disciplina_Horario" PRIMARY KEY ("Id_DiscHorario"),
    CONSTRAINT "FK_DiscHorario_Horarios" FOREIGN KEY ("Id_Horario") 
        REFERENCES "Horarios" ("Id_Horario")
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT "FK_DiscHorario_Disciplina" FOREIGN KEY ("Id_Disciplina") 
        REFERENCES "Disciplina" ("Id_Disciplinas")
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT "FK_DiscHorario_Profesor" FOREIGN KEY ("Id_Profesor") 
        REFERENCES "Profesor" ("Id_Profesor")
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- ****************************************************
-- * 13. Matricula                                    *
-- ****************************************************
CREATE TABLE IF NOT EXISTS "Matricula" (
    "Id_Matricula"      VARCHAR(10) NOT NULL,
    "Fecha_Inscripcion" DATE        NOT NULL DEFAULT CURRENT_DATE,
    "Estado_Matricula"  VARCHAR(15) NOT NULL DEFAULT 'Activa',
    "Id_alumno"         VARCHAR(10) NOT NULL,
    CONSTRAINT "PK_Matricula" PRIMARY KEY ("Id_Matricula"),
    CONSTRAINT "FK_Matricula_Alumno" FOREIGN KEY ("Id_alumno") 
        REFERENCES "Alumno" ("Id_alumno")
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- ****************************************************
-- * 14. Detalles_Matricula                           *
-- ****************************************************
CREATE TABLE IF NOT EXISTS "Detalles_Matricula" (
    "Id_DetMatricula" VARCHAR(10) NOT NULL,
    "Id_Matricula"    VARCHAR(10) NOT NULL,
    "Fecha_Inicio"    DATE        NOT NULL,
    "Fecha_Fin"       DATE        NOT NULL,
    "Id_DiscHorario"  VARCHAR(10) NOT NULL,
    CONSTRAINT "PK_Detalles_Matricula" PRIMARY KEY ("Id_DetMatricula"),
    CONSTRAINT "FK_Detalles_Matricula" FOREIGN KEY ("Id_Matricula") 
        REFERENCES "Matricula" ("Id_Matricula")
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT "FK_Detalles_DiscHorario" FOREIGN KEY ("Id_DiscHorario") 
        REFERENCES "Disciplina_Horario" ("Id_DiscHorario")
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- ****************************************************
-- * 15. Pago                                         *
-- ****************************************************
CREATE TABLE IF NOT EXISTS "Pago" (
    "Id_Pago"             VARCHAR(10)   NOT NULL,
    "Monto"               DECIMAL(10,2) NOT NULL CHECK ("Monto" >= 0),
    "Estado_Pago"         VARCHAR(15)   NOT NULL DEFAULT 'PENDIENTE',
    "Fecha_Pago"          TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "Id_Matricula"        VARCHAR(10)   NOT NULL,
    "Id_MPago"            VARCHAR(10)   NOT NULL,
    "Id_Usuario_Registro" VARCHAR(10)   NULL,
    "Numero_Comprobante"  VARCHAR(20)   NULL,
    CONSTRAINT "PK_Pago" PRIMARY KEY ("Id_Pago"),
    CONSTRAINT "FK_Pago_Matricula" FOREIGN KEY ("Id_Matricula") 
        REFERENCES "Matricula" ("Id_Matricula")
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT "FK_Pago_MetodoPago" FOREIGN KEY ("Id_MPago") 
        REFERENCES "Metodo_Pago" ("Id_MPago")
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT "FK_Pago_UsuarioRegistro" FOREIGN KEY ("Id_Usuario_Registro") 
        REFERENCES "Usuario" ("Id_Usuario")
        ON UPDATE CASCADE ON DELETE SET NULL
);

-- ****************************************************
-- * 16. Mercado_Pago                                 *
-- ****************************************************
CREATE TABLE IF NOT EXISTS "Mercado_Pago" (
    "Id_Mp_Transaccion" VARCHAR(10)  NOT NULL,
    "Preference_Id"     VARCHAR(255) NOT NULL,
    "Mp_Payment_Id"     VARCHAR(100) NULL,
    "Referencia_Ext"    VARCHAR(255) NOT NULL,
    "Fecha_Creacion"    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "Id_Pago"           VARCHAR(10)  NOT NULL,
    CONSTRAINT "PK_Mercado_Pago" PRIMARY KEY ("Id_Mp_Transaccion"),
    CONSTRAINT "UQ_Mercado_Pago_Id_Pago" UNIQUE ("Id_Pago"),
    CONSTRAINT "FK_Mercado_Pago_Pago" FOREIGN KEY ("Id_Pago") 
        REFERENCES "Pago" ("Id_Pago")
        ON UPDATE CASCADE ON DELETE CASCADE
);

-- ****************************************************
-- * 17. Envio_Comprobante                            *
-- ****************************************************
CREATE TABLE IF NOT EXISTS "Envio_Comprobante" (
    "Id_envio"        VARCHAR(10)  NOT NULL,
    "correo_destino"  VARCHAR(60)  NOT NULL,
    "intento"         SMALLINT     NOT NULL CHECK ("intento" BETWEEN 1 AND 5),
    "Estado_Envio"    VARCHAR(15)  NOT NULL DEFAULT 'PENDIENTE',
    "Job_id"          VARCHAR(50)  NULL,
    "Trace_id"        VARCHAR(50)  NULL,
    "Message_id"      VARCHAR(100) NULL,
    "Mensaje_error"   VARCHAR(255) NULL,
    "Fecha_Solicitud" TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "Fecha_Resultado" TIMESTAMPTZ  NULL,
    "Id_Pago"         VARCHAR(10)  NOT NULL,
    CONSTRAINT "PK_Envio_Comprobante" PRIMARY KEY ("Id_envio", "Id_Pago"),
    CONSTRAINT "FK_Envio_Pago" FOREIGN KEY ("Id_Pago") 
        REFERENCES "Pago" ("Id_Pago")
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- ----------------------------------------------------------------------------
-- ÍNDICES DE RENDIMIENTO (Claves Foráneas y Búsquedas Frecuentes)
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "IDX_Persona_Documento"      ON "Persona" ("Id_Documento");
CREATE INDEX IF NOT EXISTS "IDX_Profesor_Persona"       ON "Profesor" ("Id_Persona");
CREATE INDEX IF NOT EXISTS "IDX_Alumno_Persona"         ON "Alumno" ("Id_Persona");
CREATE INDEX IF NOT EXISTS "IDX_MetodoContacto_Persona"  ON "Metodo_Contacto" ("Id_Persona");
CREATE INDEX IF NOT EXISTS "IDX_Usuario_Persona"        ON "Usuario" ("Id_Persona");
CREATE INDEX IF NOT EXISTS "IDX_Matricula_Alumno"       ON "Matricula" ("Id_alumno");
CREATE INDEX IF NOT EXISTS "IDX_Detalles_Matricula"     ON "Detalles_Matricula" ("Id_Matricula");
CREATE INDEX IF NOT EXISTS "IDX_Detalles_DiscHorario"   ON "Detalles_Matricula" ("Id_DiscHorario");
CREATE INDEX IF NOT EXISTS "IDX_Pago_Matricula"         ON "Pago" ("Id_Matricula");
CREATE INDEX IF NOT EXISTS "IDX_Pago_Metodo"            ON "Pago" ("Id_MPago");
CREATE INDEX IF NOT EXISTS "IDX_MP_Payment_Id"          ON "Mercado_Pago" ("Mp_Payment_Id");


-- ============================================================================
-- PARTE 2: INSERCIÓN DE DATOS (DML) EXTRAÍDOS DE DDL VERSION 3.0
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Documentos de Identificación
-- ----------------------------------------------------------------------------
INSERT INTO "Documento_Identificacion" ("Id_Documento", "Tipo_Documento") VALUES
('DOC01', 'DNI')
ON CONFLICT ("Id_Documento") DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. Disciplinas y Tarifas Base
-- ----------------------------------------------------------------------------
INSERT INTO "Disciplina" ("Id_Disciplinas", "Nombre_Disciplina", "Descripcion", "Tarifa") VALUES
('DISC01', 'Capoeira',        'Arte marcial y danza afrobrasileña - Adultos', 120.00),
('DISC02', 'Capoeira Kids',   'Capoeira formativa para niños',                100.00),
('DISC03', 'Boxeo',           'Entrenamiento técnico de boxeo',               110.00),
('DISC04', 'MMA',             'Artes Marciales Mixtas',                       130.00),
('DISC05', 'Jiu Jitsu',       'Brazilian Jiu Jitsu - Adultos',                140.00),
('DISC06', 'Jiu Jitsu Kids',  'Brazilian Jiu Jitsu formativo para niños',     110.00)
ON CONFLICT ("Id_Disciplinas") DO UPDATE 
SET "Nombre_Disciplina" = EXCLUDED."Nombre_Disciplina",
    "Descripcion" = EXCLUDED."Descripcion",
    "Tarifa" = EXCLUDED."Tarifa";

-- ----------------------------------------------------------------------------
-- 3. Horarios
-- ----------------------------------------------------------------------------
INSERT INTO "Horarios" ("Id_Horario", "Hora_Inicio", "Hora_Fin", "Turno", "Dias") VALUES
('HOR01', '19:00:00', '20:30:00', 'Noche',   'Lunes'),
('HOR02', '19:00:00', '20:30:00', 'Noche',   'Martes'),
('HOR03', '17:30:00', '19:00:00', 'Tarde',   'Sábado'),
('HOR04', '10:00:00', '11:30:00', 'Mañana',  'S-D'),
('HOR05', '11:30:00', '13:00:00', 'Mañana',  'S-D'),
('HOR06', '07:00:00', '08:00:00', 'Mañana',  'L-M-V'),
('HOR07', '08:00:00', '09:00:00', 'Mañana',  'L-M-V'),
('HOR08', '18:00:00', '19:00:00', 'Noche',   'L-M-V'),
('HOR09', '19:00:00', '20:00:00', 'Noche',   'L-M-V'),
('HOR10', '07:00:00', '08:00:00', 'Mañana',  'L-a-V'),
('HOR11', '08:00:00', '09:00:00', 'Mañana',  'L-a-V'),
('HOR12', '20:00:00', '21:00:00', 'Noche',   'L-M-V'),
('HOR13', '07:00:00', '08:00:00', 'Mañana',  'M-J'),
('HOR14', '08:00:00', '09:00:00', 'Mañana',  'M-J'),
('HOR15', '20:30:00', '22:00:00', 'Noche',   'M-J'),
('HOR16', '21:00:00', '22:00:00', 'Noche',   'L-M-V'),
('HOR17', '17:00:00', '18:00:00', 'Tarde',   'L-M-V'),
('HOR18', '11:30:00', '13:00:00', 'Mañana',  'S-D')
ON CONFLICT ("Id_Horario") DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. Roles
-- ----------------------------------------------------------------------------
INSERT INTO "Rol" ("Id_Rol", "Rol_Cargo") VALUES
('ROL01', 'DIRECTOR'),
('ROL02', 'TESORERO'),
('ROL03', 'PROFESOR'),
('ROL04', 'ALUMNO')
ON CONFLICT ("Id_Rol") DO NOTHING;

-- ----------------------------------------------------------------------------
-- 5. Métodos de Pago
-- ----------------------------------------------------------------------------
INSERT INTO "Metodo_Pago" ("Id_MPago", "Nombre_Metodo", "Descripcion", "RPasarela", "Activo") VALUES
('MP01', 'MERCADO_PAGO',  'Pasarela de pagos en línea (Checkout)', TRUE,  TRUE),
('MP02', 'EFECTIVO',      'Pago en recepción',                     FALSE, TRUE),
('MP03', 'YAPE',          'Billetera digital móvil',               FALSE, TRUE),
('MP04', 'PLIN',          'Billetera digital móvil',               FALSE, TRUE),
('MP05', 'TRANSFERENCIA', 'Transferencia bancaria directa',        FALSE, TRUE)
ON CONFLICT ("Id_MPago") DO NOTHING;

-- ----------------------------------------------------------------------------
-- 6. Personas (Datos maestros de Profesores, Alumnos y Personal)
-- ----------------------------------------------------------------------------
INSERT INTO "Persona" (
    "Id_Persona", "Nombre", "Segundo_Nombre", "Apellido_Paterno", "Apellido_Materno",
    "Fecha_Nacimiento", "Genero", "Direccion", "Numero_Documento", "Id_Documento"
) VALUES
-- Personas correspondientes a Profesores
('PERPROF01', 'Faridh',    NULL,      'Cruz',      'Cruz',      '1985-05-15', 'M', 'No especificada', '00000011', 'DOC01'),
('PERPROF02', 'Paul',      NULL,      'Rafael',    'Rafael',    '1988-08-20', 'M', 'No especificada', '00000012', 'DOC01'),
('PERPROF03', 'Cristian',  NULL,      'Benites',   'Benites',   '1990-03-10', 'M', 'No especificada', '00000013', 'DOC01'),

-- Personas correspondientes a Alumnos
('PERALU01',  'Juan',      NULL,      'Rondón',    'Pujay',     '2000-01-01', 'M', 'No especificada', '00000001', 'DOC01'),
('PERALU02',  'Ricardo',   NULL,      'Jimenez',   'Carmen',    '2000-01-01', 'M', 'No especificada', '00000002', 'DOC01'),
('PERALU03',  'Jheremies', 'Edwin',   'Jeri',      'Condori',   '2000-01-01', 'M', 'No especificada', '00000003', 'DOC01'),
('PERALU04',  'Angel',     NULL,      'Arce',      'Arce',      '2000-01-01', 'M', 'No especificada', '00000004', 'DOC01'),
('PERALU05',  'Lia',       NULL,      'Bedriñana', 'Bedriñana', '2000-01-01', 'F', 'No especificada', '00000005', 'DOC01'),
('PERALU06',  'Ivanna',    NULL,      'Beas',      'Beas',      '2000-01-01', 'F', 'No especificada', '00000006', 'DOC01'),
('PERALU07',  'Brandon',   NULL,      'Mercado',   'Salas',     '2000-01-20', 'M', 'No especificada', '77472200', 'DOC01'),
('PERALU08',  'Sebastián', 'Emilio',  'Alarcón',   'Ambolaya',  '2001-10-14', 'M', 'No especificada', '74907159', 'DOC01'),

-- Persona para Personal Administrativo (Director / Tesorero)
('PERADM01',  'Carlos',    'Eduardo', 'Mendoza',   'Ríos',      '1980-06-12', 'M', 'Sede Central',    '10203040', 'DOC01')
ON CONFLICT ("Id_Persona") DO NOTHING;

-- ----------------------------------------------------------------------------
-- 7. Profesores
-- ----------------------------------------------------------------------------
INSERT INTO "Profesor" ("Id_Profesor", "Id_Persona", "Grado_Rango", "Biografia") VALUES
('PROF01', 'PERPROF01', 'Maestro / Instr. Principal', 'Especialista en Capoeira con amplia trayectoria formativa y cultural.'),
('PROF02', 'PERPROF02', 'Entrenador Certificado',    'Entrenador profesional en técnica de boxeo olímpico y preparación física.'),
('PROF03', 'PERPROF03', 'Faixa Preta BJJ / MMA Pro', 'Peleador profesional de MMA y cinta negra en Brazilian Jiu Jitsu.')
ON CONFLICT ("Id_Profesor") DO NOTHING;

-- ----------------------------------------------------------------------------
-- 8. Alumnos
-- ----------------------------------------------------------------------------
INSERT INTO "Alumno" ("Id_alumno", "Estado_Alumno", "Condicion", "Id_Persona") VALUES
('ALU01', 'Activo', 'Ninguna', 'PERALU01'),
('ALU02', 'Activo', 'Ninguna', 'PERALU02'),
('ALU03', 'Activo', 'Ninguna', 'PERALU03'),
('ALU04', 'Activo', 'Ninguna', 'PERALU04'),
('ALU05', 'Activo', 'Ninguna', 'PERALU05'),
('ALU06', 'Activo', 'Ninguna', 'PERALU06'),
('ALU07', 'Activo', 'Ninguna', 'PERALU07'),
('ALU08', 'Activo', 'Ninguna', 'PERALU08')
ON CONFLICT ("Id_alumno") DO NOTHING;

-- ----------------------------------------------------------------------------
-- 9. Métodos de Contacto
-- ----------------------------------------------------------------------------
INSERT INTO "Metodo_Contacto" ("Id_contacto", "Tipo_Contacto", "Contacto", "Id_Persona") VALUES
('CON01', 'CELULAR', '922673984', 'PERALU07'),
('CON02', 'CELULAR', '971400027', 'PERALU08'),
('CON03', 'CORREO',  'faridh.cruz@forcafitness.pe', 'PERPROF01'),
('CON04', 'CORREO',  'paul.rafael@forcafitness.pe', 'PERPROF02'),
('CON05', 'CORREO',  'cristian.benites@forcafitness.pe', 'PERPROF03')
ON CONFLICT ("Id_contacto") DO NOTHING;

-- ----------------------------------------------------------------------------
-- 10. Usuarios del Sistema
-- Nota: Hash bcrypt para la contraseña por defecto '123456'
-- ----------------------------------------------------------------------------
INSERT INTO "Usuario" ("Id_Usuario", "Correo", "Password_Hash", "Estado_Usuario", "Id_Persona") VALUES
('USU01', 'director@forcafitness.pe', '$2a$10$wT8hTqLv7V6nO4vE9r2D5.XN0vD1U2w3e4r5t6y7u8i9o0p1a2s3d', 'Activo', 'PERADM01'),
('USU02', 'tesorero@forcafitness.pe', '$2a$10$wT8hTqLv7V6nO4vE9r2D5.XN0vD1U2w3e4r5t6y7u8i9o0p1a2s3d', 'Activo', 'PERADM01'),
('USU03', 'prof.cristian@forcafitness.pe', '$2a$10$wT8hTqLv7V6nO4vE9r2D5.XN0vD1U2w3e4r5t6y7u8i9o0p1a2s3d', 'Activo', 'PERPROF03'),
('USU04', 'brandon.mercado@gmail.com', '$2a$10$wT8hTqLv7V6nO4vE9r2D5.XN0vD1U2w3e4r5t6y7u8i9o0p1a2s3d', 'Activo', 'PERALU07'),
('USU05', 'sebastian.alarcon@gmail.com', '$2a$10$wT8hTqLv7V6nO4vE9r2D5.XN0vD1U2w3e4r5t6y7u8i9o0p1a2s3d', 'Activo', 'PERALU08')
ON CONFLICT ("Id_Usuario") DO NOTHING;

-- ----------------------------------------------------------------------------
-- 11. Asignación de Roles a Usuarios (Usuario_Rol)
-- ----------------------------------------------------------------------------
INSERT INTO "Usuario_Rol" ("Id_Usuario", "Id_Rol") VALUES
('USU01', 'ROL01'), -- Director
('USU02', 'ROL02'), -- Tesorero
('USU03', 'ROL03'), -- Profesor
('USU04', 'ROL04'), -- Alumno (Brandon Mercado)
('USU05', 'ROL04')  -- Alumno (Sebastián Alarcón)
ON CONFLICT ("Id_Usuario", "Id_Rol") DO NOTHING;

-- ----------------------------------------------------------------------------
-- 12. Disciplina_Horario (Programación académica)
-- ----------------------------------------------------------------------------
INSERT INTO "Disciplina_Horario" ("Id_DiscHorario", "Capacidad_Max", "Id_Horario", "Id_Disciplina", "Id_Profesor") VALUES
('DH01', 25, 'HOR12', 'DISC04', 'PROF03'), -- MMA (Cristian Benites)
('DH02', 25, 'HOR15', 'DISC05', 'PROF03'), -- Jiu Jitsu (Cristian Benites)
('DH03', 20, 'HOR01', 'DISC01', 'PROF01'), -- Capoeira (Faridh Cruz)
('DH04', 20, 'HOR09', 'DISC03', 'PROF02')  -- Boxeo (Paul Rafael)
ON CONFLICT ("Id_DiscHorario") DO NOTHING;

-- ----------------------------------------------------------------------------
-- 13. Matrículas
-- ----------------------------------------------------------------------------
INSERT INTO "Matricula" ("Id_Matricula", "Fecha_Inscripcion", "Estado_Matricula", "Id_alumno") VALUES
('MAT01', CURRENT_DATE, 'Activa', 'ALU07'), -- Brandon Mercado
('MAT02', CURRENT_DATE, 'Activa', 'ALU08'), -- Sebastián Alarcón
('MAT03', CURRENT_DATE, 'Activa', 'ALU01'),
('MAT04', CURRENT_DATE, 'Activa', 'ALU02'),
('MAT05', CURRENT_DATE, 'Activa', 'ALU03'),
('MAT06', CURRENT_DATE, 'Activa', 'ALU04'),
('MAT07', CURRENT_DATE, 'Activa', 'ALU05'),
('MAT08', CURRENT_DATE, 'Activa', 'ALU06')
ON CONFLICT ("Id_Matricula") DO NOTHING;

-- ----------------------------------------------------------------------------
-- 14. Detalles de Matrícula
-- ----------------------------------------------------------------------------
INSERT INTO "Detalles_Matricula" ("Id_DetMatricula", "Id_Matricula", "Fecha_Inicio", "Fecha_Fin", "Id_DiscHorario") VALUES
('DET01', 'MAT01', CURRENT_DATE, CURRENT_DATE + INTERVAL '1 month', 'DH01'),
('DET02', 'MAT02', CURRENT_DATE, CURRENT_DATE + INTERVAL '1 month', 'DH02')
ON CONFLICT ("Id_DetMatricula") DO NOTHING;

-- ----------------------------------------------------------------------------
-- 15. Pagos Transaccionales
-- ----------------------------------------------------------------------------
INSERT INTO "Pago" (
    "Id_Pago", "Monto", "Estado_Pago", "Fecha_Pago", "Id_Matricula", "Id_MPago", "Id_Usuario_Registro", "Numero_Comprobante"
) VALUES
('PAG01', 130.00, 'CONFIRMADO', CURRENT_TIMESTAMP - INTERVAL '2 days', 'MAT01', 'MP01', 'USU02', 'B001-000001'),
('PAG02', 140.00, 'PENDIENTE',  CURRENT_TIMESTAMP - INTERVAL '1 day',  'MAT02', 'MP03', 'USU02', 'B001-000002')
ON CONFLICT ("Id_Pago") DO NOTHING;

-- ----------------------------------------------------------------------------
-- 16. Pasarela Mercado Pago
-- ----------------------------------------------------------------------------
INSERT INTO "Mercado_Pago" (
    "Id_Mp_Transaccion", "Preference_Id", "Mp_Payment_Id", "Referencia_Ext", "Fecha_Creacion", "Id_Pago"
) VALUES
('MPTR01', 'PREF-930406877976-MAT01', 'MP-PAY-789456123', 'EXT-MAT01-2026', CURRENT_TIMESTAMP - INTERVAL '2 days', 'PAG01')
ON CONFLICT ("Id_Mp_Transaccion") DO NOTHING;

-- ----------------------------------------------------------------------------
-- 17. Envíos de Comprobante
-- ----------------------------------------------------------------------------
INSERT INTO "Envio_Comprobante" (
    "Id_envio", "correo_destino", "intento", "Estado_Envio", 
    "Job_id", "Trace_id", "Message_id", "Mensaje_error", 
    "Fecha_Solicitud", "Fecha_Resultado", "Id_Pago"
) VALUES
('ENV01', 'brandon.mercado@gmail.com', 1, 'ENVIADO', 'job-1001', 'trace-5001', 'msg-9001', 'Envío exitoso sin errores', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days', 'PAG01')
ON CONFLICT ("Id_envio", "Id_Pago") DO NOTHING;

COMMIT;