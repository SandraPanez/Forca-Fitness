const db = require('../../shared/config/database');

async function buscarPorCorreo(correo) {
  const query = `
    SELECT
      u."Id_Usuario",
      u."Correo",
      u."Password_Hash",
      u."Estado_Usuario",
      u."Id_Rol",
      r."Rol_Cargo" AS "Rol"
    FROM "Academia Forca&Fitness"."Usuario" u
    INNER JOIN "Academia Forca&Fitness"."Rol" r
      ON r."Id_Rol" = u."Id_Rol"
    WHERE LOWER(u."Correo") = LOWER($1)
    LIMIT 1
  `;

  const result = await db.query(query, [correo]);

  return result.rows[0] || null;
}

async function buscarMatriculaPendientePorCorreo(correo) {
  const query = `
    SELECT
      m."Id_Matricula" AS matricula,
      LOWER(u."Correo") AS correo,
      TRIM(a."Nombre" || ' ' || COALESCE(a."Segundo_Nombre" || ' ', '') ||
        a."Apellido_Paterno" || ' ' || a."Apellido_Materno") AS nombre,
      COALESCE(SUM(d.tarifa), 0)::NUMERIC AS monto,
      COALESCE(STRING_AGG(DISTINCT d."Nombre_Disciplina", ', ' ORDER BY d."Nombre_Disciplina"), '') AS disciplinas,
      pago."Estado_Pago" AS estado_pago,
      pago."Fecha_Vencimiento" AS fecha_vencimiento,
      UPPER(mp."Nombre_Metodo") AS medio_pago
    FROM "Academia Forca&Fitness"."Usuario" u
    INNER JOIN "Academia Forca&Fitness"."Alumno" a
      ON a."Id_alumno" = u."Id_alumno"
    INNER JOIN "Academia Forca&Fitness"."Matricula" m
      ON m."Id_alumno" = a."Id_alumno"
    INNER JOIN "Academia Forca&Fitness"."Detalles_Matricula" dm
      ON dm."Id_Matricula" = m."Id_Matricula"
    INNER JOIN "Academia Forca&Fitness"."Disciplina_Horario" dh
      ON dh."Id_DiscHorario" = dm."Id_DiscHorario"
    INNER JOIN "Academia Forca&Fitness"."Disciplina" d
      ON d."Id_Disciplinas" = dh."Id_Disciplina"
    LEFT JOIN LATERAL (
      SELECT p."Estado_Pago", p."Fecha_Vencimiento", p."Id_MPago"
      FROM "Academia Forca&Fitness"."Pago" p
      WHERE p."Id_Matricula" = m."Id_Matricula"
        AND p."Estado_Pago" = 'PENDIENTE'
        AND (p."Fecha_Vencimiento" IS NULL OR p."Fecha_Vencimiento" >= CURRENT_TIMESTAMP)
      ORDER BY p."Fecha_Pago" DESC
      LIMIT 1
    ) pago ON TRUE
    LEFT JOIN "Academia Forca&Fitness"."Metodo_Pago" mp
      ON mp."Id_MPago" = pago."Id_MPago"
    WHERE LOWER(u."Correo") = LOWER($1)
      AND m."Estado_Matricula" IN ('PENDIENTE', 'Pendiente de confirmación')
      AND NOT EXISTS (
        SELECT 1
        FROM "Academia Forca&Fitness"."Pago" vencido
        WHERE vencido."Id_Matricula" = m."Id_Matricula"
          AND vencido."Id_MPago" = 'MP02'
          AND vencido."Estado_Pago" = 'PENDIENTE'
          AND vencido."Fecha_Vencimiento" < CURRENT_TIMESTAMP
      )
    GROUP BY m."Id_Matricula", u."Correo", a."Nombre", a."Segundo_Nombre",
      a."Apellido_Paterno", a."Apellido_Materno", pago."Estado_Pago",
      pago."Fecha_Vencimiento", mp."Nombre_Metodo", m."Fecha_Inscripcion"
    ORDER BY m."Fecha_Inscripcion" DESC
    LIMIT 1
  `;

  const result = await db.query(query, [correo]);
  return result.rows[0] || null;
}

module.exports = {
  buscarPorCorreo,
  buscarMatriculaPendientePorCorreo
};