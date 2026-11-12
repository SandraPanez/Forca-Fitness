CREATE TABLE IF NOT EXISTS "Academia Forca&Fitness"."Envio_Comprobante" (
    "Id_envio" VARCHAR(10) NOT NULL,
    "correo_destino" VARCHAR(60) NOT NULL,
    "intento" SMALLINT NOT NULL,
    "Estado_Envio" VARCHAR(15) NOT NULL,
    "Job_id" VARCHAR(50),
    "Trace_id" VARCHAR(50),
    "Message_id" VARCHAR(100),
    "Mensaje_error" VARCHAR(255),
    "Fecha_Solicitud" TIMESTAMPTZ NOT NULL,
    "Fecha_Resultado" TIMESTAMPTZ,
    "Id_Pago" VARCHAR(10) NOT NULL,

    CONSTRAINT "PK_Envio_Comprobante"
        PRIMARY KEY ("Id_envio", "Id_Pago"),

    CONSTRAINT "Envio_Comprobante_intento_check"
        CHECK ("intento" BETWEEN 1 AND 3),

    CONSTRAINT "Pago_Envio"
        FOREIGN KEY ("Id_Pago")
        REFERENCES "Academia Forca&Fitness"."Pago" ("Id_Pago")
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);