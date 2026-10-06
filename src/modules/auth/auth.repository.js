const db = require('../../shared/config/database');

async function buscarPorCorreo(correo) {
  const query = `
    SELECT
      u."Id_Usuario",
      u."Correo",
      u."Password_Hash",
      u."Estado_Usuario",
      r."Rol_Cargo" AS "Rol"
    FROM "Academia Forca&Fitness"."Usuario" u
    INNER JOIN "Academia Forca&Fitness"."Usuario_Rol" ur
      ON ur."Id_Usuario" = u."Id_Usuario"
    INNER JOIN "Academia Forca&Fitness"."Rol" r
      ON r."Id_Rol" = ur."Id_Rol"
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
      TRIM(p."Nombre" || ' ' || COALESCE(p."Segundo_Nombre" || ' ', '') ||
        p."Apellido_Paterno" || ' ' || p."Apellido_Materno") AS nombre,
      COALESCE(SUM(d."Tarifa"), 0)::NUMERIC AS monto,
      COALESCE(STRING_AGG(DISTINCT d."Nombre_Disciplina", ', ' ORDER BY d."Nombre_Disciplina"), '') AS disciplinas,
      pago."Estado_Pago" AS estado_pago,
      pago."Fecha_Pago" + INTERVAL '48 hours' AS fecha_vencimiento,
      UPPER(mp."Nombre_Metodo") AS medio_pago
    FROM "Academia Forca&Fitness"."Usuario" u
    INNER JOIN "Academia Forca&Fitness"."Persona" p
      ON p."Id_Persona" = u."Id_Persona"
    INNER JOIN "Academia Forca&Fitness"."Alumno" a
      ON a."Id_Persona" = p."Id_Persona"
    INNER JOIN "Academia Forca&Fitness"."Matricula" m
      ON m."Id_alumno" = a."Id_alumno"
    INNER JOIN "Academia Forca&Fitness"."Detalles_Matricula" dm
      ON dm."Id_Matricula" = m."Id_Matricula"
    INNER JOIN "Academia Forca&Fitness"."Disciplina_Horario" dh
      ON dh."Id_DiscHorario" = dm."Id_DiscHorario"
    INNER JOIN "Academia Forca&Fitness"."Disciplina" d
      ON d."Id_Disciplinas" = dh."Id_Disciplina"
    LEFT JOIN LATERAL (
      SELECT pay."Estado_Pago", pay."Fecha_Pago", pay."Id_MPago"
      FROM "Academia Forca&Fitness"."Pago" pay
      WHERE pay."Id_Matricula" = m."Id_Matricula"
        AND pay."Estado_Pago" = 'PENDIENTE'
        AND pay."Fecha_Pago" + INTERVAL '48 hours' >= CURRENT_TIMESTAMP
      ORDER BY pay."Fecha_Pago" DESC
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
          AND vencido."Fecha_Pago" + INTERVAL '48 hours' < CURRENT_TIMESTAMP
      )
    GROUP BY m."Id_Matricula", u."Correo", p."Nombre", p."Segundo_Nombre",
      p."Apellido_Paterno", p."Apellido_Materno", pago."Estado_Pago",
      pago."Fecha_Pago", mp."Nombre_Metodo", m."Fecha_Inscripcion"
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