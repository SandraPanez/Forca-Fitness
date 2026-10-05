BEGIN;

CREATE SCHEMA IF NOT EXISTS "Academia Forca&Fitness";

ALTER TABLE IF EXISTS "Academia Forca&Fitness"."Disciplina"
  ADD COLUMN IF NOT EXISTS tarifa INTEGER NOT NULL DEFAULT 150;

ALTER TABLE IF EXISTS "Academia Forca&Fitness"."Pago"
  ADD COLUMN IF NOT EXISTS "Fecha_Vencimiento" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "Referencia_Operacion" VARCHAR(255);

CREATE TABLE IF NOT EXISTS "Academia Forca&Fitness"."Metodo_Pago" (
  "Id_MPago" VARCHAR(10) PRIMARY KEY,
  "Nombre_Metodo" VARCHAR(40) NOT NULL UNIQUE,
  "Descripcion" VARCHAR(255),
  "RPasarela" BOOLEAN NOT NULL DEFAULT FALSE,
  "Activo" BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO "Academia Forca&Fitness"."Metodo_Pago"
  ("Id_MPago", "Nombre_Metodo", "Descripcion", "RPasarela")
VALUES
  ('MP01', 'MERCADO_PAGO', 'Pago en línea mediante Mercado Pago', TRUE),
  ('MP02', 'EFECTIVO', 'Pago presencial en recepción', FALSE)
ON CONFLICT ("Id_MPago") DO NOTHING;

CREATE TABLE IF NOT EXISTS "Academia Forca&Fitness"."Pago" (
  "Id_Pago" VARCHAR(20) PRIMARY KEY,
  "Monto" NUMERIC(10, 2) NOT NULL CHECK ("Monto" > 0),
  "Estado_Pago" VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
  "Fecha_Pago" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "Fecha_Vencimiento" TIMESTAMPTZ,
  "Referencia_Operacion" VARCHAR(255),
  "Id_Matricula" VARCHAR(10) NOT NULL,
  "Id_MPago" VARCHAR(10) NOT NULL REFERENCES "Academia Forca&Fitness"."Metodo_Pago" ("Id_MPago")
);

CREATE TABLE IF NOT EXISTS "Academia Forca&Fitness"."Mercado_Pago" (
  "Id_Mp_Transaccion" VARCHAR(20) PRIMARY KEY,
  "Preference_Id" VARCHAR(255) NOT NULL,
  "Mp_Payment_Id" VARCHAR(100),
  "Referencia_Ext" VARCHAR(255) NOT NULL,
  "Fecha_Creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "Id_Pago" VARCHAR(20) NOT NULL UNIQUE
    REFERENCES "Academia Forca&Fitness"."Pago" ("Id_Pago") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "Academia Forca&Fitness"."Registro_Cobro" (
  "Id_Registro" VARCHAR(20) PRIMARY KEY,
  "Fecha_Hora" TIMESTAMPTZ NOT NULL,
  "Monto" NUMERIC(10, 2) NOT NULL CHECK ("Monto" > 0),
  "Medio_Pago" VARCHAR(40) NOT NULL,
  "Resultado" VARCHAR(20) NOT NULL,
  "Id_Pago" VARCHAR(20) NOT NULL
    REFERENCES "Academia Forca&Fitness"."Pago" ("Id_Pago"),
  "Referencia_Operacion" VARCHAR(255)
);

CREATE OR REPLACE FUNCTION "Academia Forca&Fitness".bloquear_cambios_registro_cobro()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Registro_Cobro es inmutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_registro_cobro_inmutable
  ON "Academia Forca&Fitness"."Registro_Cobro";
CREATE TRIGGER trg_registro_cobro_inmutable
BEFORE UPDATE OR DELETE ON "Academia Forca&Fitness"."Registro_Cobro"
FOR EACH ROW EXECUTE FUNCTION
  "Academia Forca&Fitness".bloquear_cambios_registro_cobro();

CREATE OR REPLACE FUNCTION "Academia Forca&Fitness".anular_solicitudes_efectivo()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE "Academia Forca&Fitness"."Pago"
  SET "Estado_Pago" = 'ANULADO'
  WHERE "Id_MPago" = 'MP02'
    AND "Estado_Pago" = 'PENDIENTE'
    AND "Fecha_Vencimiento" < CURRENT_TIMESTAMP;

  UPDATE "Academia Forca&Fitness"."Matricula" m
  SET "Estado_Matricula" = 'Anulada'
  WHERE "Id_Matricula" IN (
    SELECT p."Id_Matricula"
    FROM "Academia Forca&Fitness"."Pago" p
    WHERE p."Id_MPago" = 'MP02' AND p."Estado_Pago" = 'ANULADO'
  );
END;
$$;

CREATE INDEX IF NOT EXISTS idx_pago_matricula
  ON "Academia Forca&Fitness"."Pago" ("Id_Matricula");
CREATE INDEX IF NOT EXISTS idx_pago_vencimiento
  ON "Academia Forca&Fitness"."Pago" ("Fecha_Vencimiento")
  WHERE "Estado_Pago" = 'PENDIENTE';

CREATE UNIQUE INDEX IF NOT EXISTS uq_mercado_pago_payment_id
  ON "Academia Forca&Fitness"."Mercado_Pago" ("Mp_Payment_Id")
  WHERE "Mp_Payment_Id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pago_efectivo_pendiente_matricula
  ON "Academia Forca&Fitness"."Pago" ("Id_Matricula")
  WHERE "Id_MPago" = 'MP02' AND "Estado_Pago" = 'PENDIENTE';

COMMIT;
