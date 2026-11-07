BEGIN;

-- 1. Creación del esquema y asignación de ruta
CREATE SCHEMA IF NOT EXISTS "Academia Forca&Fitness";
SET search_path TO "Academia Forca&Fitness", public;

-- ==========================================================
-- 1. DOCUMENTO DE IDENTIFICACIÓN
-- ==========================================================
CREATE TABLE "Documento_Identificacion" (
    "Id_Documento"   VARCHAR(10) NOT NULL,
    "Tipo_Documento" VARCHAR(20) NOT NULL,
    CONSTRAINT "PK_Documento_Identificacion" PRIMARY KEY ("Id_Documento")
);

-- ==========================================================
-- 2. PERSONA (Superentidad central)
-- ==========================================================
CREATE TABLE "Persona" (
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

-- ==========================================================
-- 3. MÉTODO DE CONTACTO
-- ==========================================================
CREATE TABLE "Metodo_Contacto" (
    "Id_contacto"   VARCHAR(10) NOT NULL,
    "Tipo_Contacto" VARCHAR(20) NOT NULL,
    "Contacto"      VARCHAR(50) NOT NULL,
    "Id_Persona"    VARCHAR(10) NOT NULL,
    CONSTRAINT "PK_Metodo_Contacto" PRIMARY KEY ("Id_contacto"),
    CONSTRAINT "FK_Contacto_Persona" FOREIGN KEY ("Id_Persona") 
        REFERENCES "Persona" ("Id_Persona")
        ON UPDATE CASCADE ON DELETE CASCADE
);

-- ==========================================================
-- 4. SEGURIDAD Y ACCESOS: ROL, USUARIO Y USUARIO_ROL
-- ==========================================================
CREATE TABLE "Rol" (
    "Id_Rol"    VARCHAR(10) NOT NULL,
    "Rol_Cargo" VARCHAR(20) NOT NULL,
    CONSTRAINT "PK_Rol" PRIMARY KEY ("Id_Rol"),
    CONSTRAINT "UQ_Rol_Cargo" UNIQUE ("Rol_Cargo")
);

CREATE TABLE "Usuario" (
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

CREATE TABLE "Usuario_Rol" (
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

-- ==========================================================
-- 5. CATÁLOGO ACADÉMICO: DISCIPLINA Y HORARIOS
-- ==========================================================
CREATE TABLE "Disciplina" (
    "Id_Disciplinas"    VARCHAR(10)   NOT NULL,
    "Nombre_Disciplina" VARCHAR(50)   NOT NULL,
    "Descripcion"       VARCHAR(200)  NOT NULL,
    "Tarifa"            DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    CONSTRAINT "PK_Disciplina" PRIMARY KEY ("Id_Disciplinas")
);

CREATE TABLE "Horarios" (
    "Id_Horario"  VARCHAR(10) NOT NULL,
    "Hora_Inicio" TIME        NOT NULL,
    "Hora_Fin"    TIME        NOT NULL,
    "Turno"       VARCHAR(10) NOT NULL,
    "Dias"        VARCHAR(20) NOT NULL,
    CONSTRAINT "PK_Horarios" PRIMARY KEY ("Id_Horario")
);

-- ==========================================================
-- 6. PERFILES DE NEGOCIO: PROFESOR Y DISCIPLINA_HORARIO
-- ==========================================================
CREATE TABLE "Profesor" (
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

CREATE TABLE "Disciplina_Horario" (
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

-- ==========================================================
-- 7. ALUMNO, MATRÍCULA Y DETALLES
-- ==========================================================
CREATE TABLE "Alumno" (
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

CREATE TABLE "Matricula" (
    "Id_Matricula"      VARCHAR(10) NOT NULL,
    "Fecha_Inscripcion" DATE        NOT NULL DEFAULT CURRENT_DATE,
    "Estado_Matricula"  VARCHAR(15) NOT NULL DEFAULT 'Activa',
    "Id_alumno"         VARCHAR(10) NOT NULL,
    CONSTRAINT "PK_Matricula" PRIMARY KEY ("Id_Matricula"),
    CONSTRAINT "FK_Matricula_Alumno" FOREIGN KEY ("Id_alumno") 
        REFERENCES "Alumno" ("Id_alumno")
        ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE "Detalles_Matricula" (
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

-- ==========================================================
-- 8. PAGOS Y PASARELA (MERCADO PAGO)
-- ==========================================================
CREATE TABLE "Metodo_Pago" (
    "Id_MPago"      VARCHAR(10)  NOT NULL,
    "Nombre_Metodo" VARCHAR(20)  NOT NULL,
    "Descripcion"   VARCHAR(100) NULL,
    "RPasarela"     BOOLEAN      NOT NULL DEFAULT FALSE,
    "Activo"        BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT "PK_Metodo_Pago" PRIMARY KEY ("Id_MPago"),
    CONSTRAINT "UQ_Metodo_Pago_Nombre" UNIQUE ("Nombre_Metodo")
);

CREATE TABLE "Pago" (
    "Id_Pago"             VARCHAR(10)   NOT NULL,
    "Monto"               DECIMAL(10,2) NOT NULL CHECK ("Monto" >= 0),
    "Estado_Pago"         VARCHAR(15)   NOT NULL DEFAULT 'PENDIENTE',
    "Fecha_Pago"          TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "Id_Matricula"        VARCHAR(10)   NOT NULL,
    "Id_MPago"            VARCHAR(10)   NOT NULL,
    "Id_Usuario_Registro" VARCHAR(10)   NULL,
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

CREATE TABLE "Mercado_Pago" (
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

CREATE TABLE IF NOT EXISTS "Registro_Cobro" (
    "Id_Registro" VARCHAR(20) PRIMARY KEY,
    "Fecha_Hora" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "Monto" DECIMAL(10,2) NOT NULL,
    "Medio_Pago" VARCHAR(20) NOT NULL,
    "Resultado" VARCHAR(20) NOT NULL,
    "Id_Pago" VARCHAR(10) NOT NULL REFERENCES "Pago" ("Id_Pago"),
    "Referencia_Operacion" VARCHAR(255)
);

CREATE OR REPLACE FUNCTION impedir_cambios_registro_cobro()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Registro_Cobro es inmutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "TR_Registro_Cobro_Inmutable" ON "Registro_Cobro";
CREATE TRIGGER "TR_Registro_Cobro_Inmutable"
BEFORE UPDATE OR DELETE ON "Registro_Cobro"
FOR EACH ROW EXECUTE FUNCTION impedir_cambios_registro_cobro();

-- ==========================================================
-- 9. ÍNDICES DE RENDIMIENTO (Optimización de consultas)
-- ==========================================================
CREATE INDEX "IDX_Usuario_Persona"       ON "Usuario" ("Id_Persona");
CREATE INDEX "IDX_MetodoContacto_Persona" ON "Metodo_Contacto" ("Id_Persona");
CREATE INDEX "IDX_Profesor_Persona"      ON "Profesor" ("Id_Persona");
CREATE INDEX "IDX_Alumno_Persona"        ON "Alumno" ("Id_Persona");
CREATE INDEX "IDX_Pago_Matricula"        ON "Pago" ("Id_Matricula");
CREATE INDEX "IDX_Pago_Metodo"           ON "Pago" ("Id_MPago");
CREATE INDEX "IDX_MP_Payment_Id"         ON "Mercado_Pago" ("Mp_Payment_Id");

COMMIT;