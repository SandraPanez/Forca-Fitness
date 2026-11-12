-- HU-15 / PSW-295: conservar el precio original y los datos del descuento
-- junto al importe realmente cobrado. Ejecutar una vez en cada base existente.
ALTER TABLE "Academia Forca&Fitness"."Registro_Cobro"
    ADD COLUMN IF NOT EXISTS "Monto_Original" DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS "Tipo_Descuento" VARCHAR(20),
    ADD COLUMN IF NOT EXISTS "Valor_Descuento" DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS "Monto_Descuento" DECIMAL(10,2) NOT NULL DEFAULT 0.00;
