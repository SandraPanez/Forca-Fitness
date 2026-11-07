const db = require('../../shared/config/database');

const SCHEMA = '"Academia Forca&Fitness"';

async function buscarPorUsuarioId(idUsuario) {
  const query = `
    SELECT
      p."Id_Profesor" AS id,
      TRIM(CONCAT_WS(
        ' ',
        pe."Nombre",
        pe."Segundo_Nombre",
        pe."Apellido_Paterno",
        pe."Apellido_Materno"
      )) AS nombre,
      COALESCE(
        ARRAY_AGG(
          DISTINCT d."Nombre_Disciplina"
          ORDER BY d."Nombre_Disciplina"
        ) FILTER (WHERE d."Nombre_Disciplina" IS NOT NULL),
        ARRAY[]::VARCHAR[]
      ) AS disciplinas
    FROM ${SCHEMA}."Usuario" u
    INNER JOIN ${SCHEMA}."Profesor" p
      ON p."Id_Persona" = u."Id_Persona"
    INNER JOIN ${SCHEMA}."Persona" pe
      ON pe."Id_Persona" = p."Id_Persona"
    LEFT JOIN ${SCHEMA}."Disciplina_Horario" dh
      ON dh."Id_Profesor" = p."Id_Profesor"
    LEFT JOIN ${SCHEMA}."Disciplina" d
      ON d."Id_Disciplinas" = dh."Id_Disciplina"
    WHERE u."Id_Usuario" = $1
    GROUP BY
      p."Id_Profesor",
      pe."Nombre",
      pe."Segundo_Nombre",
      pe."Apellido_Paterno",
      pe."Apellido_Materno"
    LIMIT 1
  `;

  const result = await db.query(query, [idUsuario]);
  return result.rows[0] || null;
}

module.exports = {
  buscarPorUsuarioId
};
