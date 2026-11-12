-- ============================================================================
-- CONSULTAS POSTGRESQL: BALANCE DE INGRESOS Y PAGOS (HU-16)
-- Esquema: "Academia Forca&Fitness"
-- Nota: Solo lectura / consulta. Las operaciones aprobadas no son alterables.
-- El desglose de HU-15 requiere aplicar hu15-descuentos-migration.sql antes.
-- ============================================================================

-- 1. Índices de rendimiento para consultas de balance por periodo y estado
CREATE INDEX IF NOT EXISTS "IDX_Pago_Estado_Fecha"
    ON "Academia Forca&Fitness"."Pago" ("Estado_Pago", "Fecha_Pago" DESC);

CREATE INDEX IF NOT EXISTS "IDX_RegistroCobro_Pago_Resultado_Fecha"
    ON "Academia Forca&Fitness"."Registro_Cobro" ("Id_Pago", "Resultado", "Fecha_Hora" DESC);

-- 1.1 Protección de inmutabilidad en base de datos para pagos aprobados y montos
CREATE OR REPLACE FUNCTION "Academia Forca&Fitness".impedir_alteracion_pago_aprobado()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'No está permitido eliminar transacciones de pago registradas.';
    END IF;
    IF UPPER(OLD."Estado_Pago") = 'APROBADO' THEN
        RAISE EXCEPTION 'Las transacciones aprobadas son inmutables y no pueden modificarse.';
    END IF;
    IF NEW."Monto" IS DISTINCT FROM OLD."Monto" THEN
        RAISE EXCEPTION 'El monto de una transacción de pago no puede ser editado.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "TR_Pago_Inmutable_Aprobado"
    ON "Academia Forca&Fitness"."Pago";
CREATE TRIGGER "TR_Pago_Inmutable_Aprobado"
    BEFORE UPDATE OR DELETE ON "Academia Forca&Fitness"."Pago"
    FOR EACH ROW EXECUTE FUNCTION "Academia Forca&Fitness".impedir_alteracion_pago_aprobado();

-- ============================================================================
-- 2. CONSULTA AGREGADA: RESUMEN FINANCIERO DEL PERIODO SELECCIONADO
-- Parámetros: $1 = fechaInicio (DATE), $2 = fechaFin (DATE), [$3 = medio_pago]
-- Zona horaria aplicada: America/Lima (UTC-5)
-- ============================================================================
WITH operaciones_periodo AS (
    SELECT
        p."Id_Pago" AS id_pago,
        COALESCE(cobro."Monto", p."Monto")::NUMERIC(10,2) AS monto,
        UPPER(p."Estado_Pago") AS estado_pago,
        UPPER(REPLACE(mp."Nombre_Metodo", ' ', '_')) AS medio_pago
    FROM "Academia Forca&Fitness"."Pago" p
    JOIN "Academia Forca&Fitness"."Metodo_Pago" mp ON mp."Id_MPago" = p."Id_MPago"
    LEFT JOIN LATERAL (
        SELECT rc."Fecha_Hora", rc."Monto"
        FROM "Academia Forca&Fitness"."Registro_Cobro" rc
        WHERE rc."Id_Pago" = p."Id_Pago"
          AND UPPER(rc."Resultado") = 'APROBADO'
        ORDER BY rc."Fecha_Hora" DESC
        LIMIT 1
    ) cobro ON TRUE
    WHERE (COALESCE(cobro."Fecha_Hora", p."Fecha_Pago") AT TIME ZONE 'America/Lima')::date
          BETWEEN $1::date AND $2::date
      -- Filtro opcional por medio de pago:
      -- AND UPPER(REPLACE(mp."Nombre_Metodo", ' ', '_')) = $3
)
SELECT
    COALESCE(SUM(monto) FILTER (WHERE estado_pago = 'APROBADO'), 0)::NUMERIC(12,2) AS total_ingresos,
    COUNT(DISTINCT id_pago) FILTER (WHERE estado_pago = 'APROBADO')::int AS total_operaciones,
    COALESCE(SUM(monto) FILTER (WHERE estado_pago = 'APROBADO' AND medio_pago = 'EFECTIVO'), 0)::NUMERIC(12,2) AS ingresos_efectivo,
    COUNT(DISTINCT id_pago) FILTER (WHERE estado_pago = 'APROBADO' AND medio_pago = 'EFECTIVO')::int AS operaciones_efectivo,
    COALESCE(SUM(monto) FILTER (WHERE estado_pago = 'APROBADO' AND medio_pago = 'MERCADO_PAGO'), 0)::NUMERIC(12,2) AS ingresos_mercado_pago,
    COUNT(DISTINCT id_pago) FILTER (WHERE estado_pago = 'APROBADO' AND medio_pago = 'MERCADO_PAGO')::int AS operaciones_mercado_pago,
    COUNT(DISTINCT id_pago) FILTER (WHERE estado_pago = 'PENDIENTE')::int AS operaciones_pendientes,
    COUNT(DISTINCT id_pago) FILTER (WHERE estado_pago IN ('ANULADO', 'RECHAZADO'))::int AS operaciones_no_completadas
FROM operaciones_periodo;

-- ============================================================================
-- 3. CONSULTA DE LISTADO: INGRESOS Y PAGOS APROBADOS DEL PERIODO
-- Parámetros: $1 = fechaInicio (DATE), $2 = fechaFin (DATE), [$3 = medio_pago]
-- ============================================================================
SELECT
    p."Id_Pago" AS id_pago,
    cobro."Id_Registro" AS id_registro,
    p."Id_Matricula" AS id_matricula,
    COALESCE(cobro."Monto", p."Monto")::NUMERIC(10,2) AS monto,
    COALESCE(cobro."Monto_Original", p."Monto")::NUMERIC(10,2) AS monto_original,
    cobro."Tipo_Descuento" AS tipo_descuento,
    cobro."Valor_Descuento"::NUMERIC(10,2) AS valor_descuento,
    COALESCE(cobro."Monto_Descuento", 0)::NUMERIC(10,2) AS monto_descuento,
    UPPER(p."Estado_Pago") AS estado_pago,
    p."Fecha_Pago" AS fecha_solicitud,
    COALESCE(cobro."Fecha_Hora", p."Fecha_Pago") AS fecha_operacion,
    UPPER(REPLACE(mp."Nombre_Metodo", ' ', '_')) AS medio_pago,
    mp."Nombre_Metodo" AS metodo_nombre,
    COALESCE(NULLIF(TRIM(cobro."Referencia_Operacion"), ''), NULLIF(TRIM(mptx."Mp_Payment_Id"), ''), '') AS referencia,
    TRIM(per."Nombre" || ' ' || COALESCE(per."Segundo_Nombre" || ' ', '') ||
        per."Apellido_Paterno" || ' ' || per."Apellido_Materno") AS alumno,
    COALESCE(doc."Tipo_Documento", 'DNI') AS tipo_documento,
    per."Numero_Documento" AS dni,
    (
        SELECT mc."Contacto"
        FROM "Academia Forca&Fitness"."Metodo_Contacto" mc
        WHERE mc."Id_Persona" = a."Id_Persona"
          AND UPPER(mc."Tipo_Contacto") = 'CORREO'
        LIMIT 1
    ) AS correo,
    COALESCE(det.disciplinas, 'Mensualidad') AS disciplinas,
    det.periodo AS periodo_matricula,
    CASE
        WHEN UPPER(REPLACE(mp."Nombre_Metodo", ' ', '_')) = 'MERCADO_PAGO' THEN 'Pasarela Mercado Pago'
        ELSE COALESCE(
            NULLIF(TRIM(COALESCE(per_reg."Nombre", '') || ' ' || COALESCE(per_reg."Apellido_Paterno", '')), ''),
            u_reg."Correo",
            'Tesorería'
        )
    END AS registrado_por,
    (
        SELECT COUNT(DISTINCT rc."Id_Pago")
        FROM "Academia Forca&Fitness"."Registro_Cobro" rc
        WHERE UPPER(rc."Resultado") = 'APROBADO'
          AND rc."Fecha_Hora" <= COALESCE(cobro."Fecha_Hora", p."Fecha_Pago")
          AND DATE_TRUNC('year', rc."Fecha_Hora" AT TIME ZONE 'America/Lima') =
              DATE_TRUNC('year', COALESCE(cobro."Fecha_Hora", p."Fecha_Pago") AT TIME ZONE 'America/Lima')
    )::int AS correlativo
FROM "Academia Forca&Fitness"."Pago" p
JOIN "Academia Forca&Fitness"."Metodo_Pago" mp ON mp."Id_MPago" = p."Id_MPago"
JOIN "Academia Forca&Fitness"."Matricula" m ON m."Id_Matricula" = p."Id_Matricula"
JOIN "Academia Forca&Fitness"."Alumno" a ON a."Id_alumno" = m."Id_alumno"
JOIN "Academia Forca&Fitness"."Persona" per ON per."Id_Persona" = a."Id_Persona"
LEFT JOIN "Academia Forca&Fitness"."Documento_Identificacion" doc ON doc."Id_Documento" = per."Id_Documento"
LEFT JOIN "Academia Forca&Fitness"."Usuario" u_reg ON u_reg."Id_Usuario" = p."Id_Usuario_Registro"
LEFT JOIN "Academia Forca&Fitness"."Persona" per_reg ON per_reg."Id_Persona" = u_reg."Id_Persona"
LEFT JOIN LATERAL (
    SELECT
        rc."Id_Registro",
        rc."Fecha_Hora",
        rc."Referencia_Operacion",
        rc."Monto",
        rc."Monto_Original",
        rc."Tipo_Descuento",
        rc."Valor_Descuento",
        rc."Monto_Descuento"
    FROM "Academia Forca&Fitness"."Registro_Cobro" rc
    WHERE rc."Id_Pago" = p."Id_Pago"
      AND UPPER(rc."Resultado") = 'APROBADO'
    ORDER BY rc."Fecha_Hora" DESC
    LIMIT 1
) cobro ON TRUE
LEFT JOIN "Academia Forca&Fitness"."Mercado_Pago" mptx ON mptx."Id_Pago" = p."Id_Pago"
LEFT JOIN LATERAL (
    SELECT
        STRING_AGG(DISTINCT d."Nombre_Disciplina", ', ' ORDER BY d."Nombre_Disciplina") AS disciplinas,
        TO_CHAR(MIN(dm."Fecha_Inicio"), 'DD/MM/YYYY') || ' - ' || TO_CHAR(MAX(dm."Fecha_Fin"), 'DD/MM/YYYY') AS periodo
    FROM "Academia Forca&Fitness"."Detalles_Matricula" dm
    JOIN "Academia Forca&Fitness"."Disciplina_Horario" dh ON dh."Id_DiscHorario" = dm."Id_DiscHorario"
    JOIN "Academia Forca&Fitness"."Disciplina" d ON d."Id_Disciplinas" = dh."Id_Disciplina"
    WHERE dm."Id_Matricula" = m."Id_Matricula"
) det ON TRUE
WHERE UPPER(p."Estado_Pago") = 'APROBADO'
  AND (COALESCE(cobro."Fecha_Hora", p."Fecha_Pago") AT TIME ZONE 'America/Lima')::date
      BETWEEN $1::date AND $2::date
  -- Filtro opcional por medio de pago:
  -- AND UPPER(REPLACE(mp."Nombre_Metodo", ' ', '_')) = $3
ORDER BY COALESCE(cobro."Fecha_Hora", p."Fecha_Pago") DESC;

-- ============================================================================
-- 4. CONSULTA DE DETALLE INDIVIDUAL (MODO CONSULTA / SOLO LECTURA)
-- Parámetro: $1 = id_pago (VARCHAR)
-- Misma proyección de campos filtrada por:
-- WHERE p."Id_Pago" = $1 AND UPPER(p."Estado_Pago") = 'APROBADO' LIMIT 1;
-- ============================================================================
