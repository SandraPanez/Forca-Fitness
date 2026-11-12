-- HU-26: precio base editable y una única promoción activa por disciplina.
-- Ejecutar una vez en cada base existente (igual que hu15-descuentos-migration.sql).
--
-- * Disciplina."Tarifa" sigue siendo el precio base.
-- * La promoción vive en columnas de la propia disciplina, por lo que solo puede
--   existir UNA a la vez (no hay descuentos acumulados). Sin promoción = columnas NULL.
-- * Detalles_Matricula."Tarifa_Aplicada" congela el precio de las matrículas ya
--   registradas cuando el Director cambia el precio: los cambios solo afectan a
--   matrículas futuras. NULL = la matrícula se registró con el precio vigente.

ALTER TABLE "Academia Forca&Fitness"."Disciplina"
    ADD COLUMN IF NOT EXISTS "Promocion_Tipo" VARCHAR(20),
    ADD COLUMN IF NOT EXISTS "Promocion_Valor" DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS "Promocion_Texto" VARCHAR(40);

ALTER TABLE "Academia Forca&Fitness"."Detalles_Matricula"
    ADD COLUMN IF NOT EXISTS "Tarifa_Aplicada" DECIMAL(10,2);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CK_Disciplina_Promocion'
    ) THEN
        ALTER TABLE "Academia Forca&Fitness"."Disciplina"
            ADD CONSTRAINT "CK_Disciplina_Promocion" CHECK (
                (
                    "Promocion_Tipo" IS NULL
                    AND "Promocion_Valor" IS NULL
                    AND "Promocion_Texto" IS NULL
                )
                OR (
                    -- IS NOT NULL explícito: un CHECK que evalúa a NULL se acepta.
                    "Promocion_Tipo" IS NOT NULL
                    AND "Promocion_Valor" IS NOT NULL
                    AND "Promocion_Texto" IS NOT NULL
                    AND "Promocion_Tipo" IN ('PORCENTAJE', 'MONTO_FIJO')
                    AND "Promocion_Valor" > 0
                    AND BTRIM("Promocion_Texto") <> ''
                    AND ("Promocion_Tipo" <> 'PORCENTAJE' OR "Promocion_Valor" < 100)
                    AND ("Promocion_Tipo" <> 'MONTO_FIJO' OR "Promocion_Valor" < "Tarifa")
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CK_Detalles_Tarifa_Aplicada'
    ) THEN
        ALTER TABLE "Academia Forca&Fitness"."Detalles_Matricula"
            ADD CONSTRAINT "CK_Detalles_Tarifa_Aplicada"
            CHECK ("Tarifa_Aplicada" IS NULL OR "Tarifa_Aplicada" >= 0);
    END IF;
END $$;
