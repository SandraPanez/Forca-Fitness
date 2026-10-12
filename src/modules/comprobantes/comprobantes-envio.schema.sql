CREATE TABLE IF NOT EXISTS "Academia Forca&Fitness"."Envio_Comprobante" (
    "Id_Envio" BIGSERIAL PRIMARY KEY,
    "Id_Pago" VARCHAR(10) NOT NULL,
    "Correo_Destino" VARCHAR(100) NOT NULL,
    "Numero_Comprobante" VARCHAR(30) NOT NULL,
    "Intento" SMALLINT NOT NULL,
    "Estado" VARCHAR(15) NOT NULL DEFAULT 'PENDIENTE',
    "Job_Id" VARCHAR(100),
    "Trace_Id" VARCHAR(100),
    "Message_Id" VARCHAR(255),
    "Error" TEXT,
    "Fecha_Solicitud" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "Fecha_Resultado" TIMESTAMPTZ,

    CONSTRAINT "FK_Envio_Comprobante_Pago"
        FOREIGN KEY ("Id_Pago")
        REFERENCES "Academia Forca&Fitness"."Pago" ("Id_Pago")
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT "CK_Envio_Comprobante_Intento"
        CHECK ("Intento" BETWEEN 1 AND 3),

    CONSTRAINT "CK_Envio_Comprobante_Estado"
        CHECK ("Estado" IN ('PENDIENTE', 'ENVIADO', 'ERROR')),

    CONSTRAINT "UQ_Envio_Comprobante_Pago_Intento"
        UNIQUE ("Id_Pago", "Intento")
);

CREATE INDEX IF NOT EXISTS "IDX_Envio_Comprobante_Pago"
    ON "Academia Forca&Fitness"."Envio_Comprobante" ("Id_Pago");

CREATE INDEX IF NOT EXISTS "IDX_Envio_Comprobante_Estado"
    ON "Academia Forca&Fitness"."Envio_Comprobante" ("Estado");