const db = require('../../shared/config/database');

const SCHEMA = '"Academia Forca&Fitness"';

// Cuentas activas que tienen rol Tesorero y/o Profesor (el personal operativo)
async function listarPersonalOperativo() {
  const query = `
    SELECT
      u."Id_Usuario" AS id,
      TRIM(CONCAT_WS(
        ' ',
        NULLIF(BTRIM(pe."Nombre"), ''),
        NULLIF(BTRIM(pe."Segundo_Nombre"), ''),
        NULLIF(BTRIM(pe."Apellido_Paterno"), ''),
        NULLIF(BTRIM(pe."Apellido_Materno"), '')
      )) AS nombre,
      ARRAY_AGG(DISTINCT UPPER(r."Rol_Cargo") ORDER BY UPPER(r."Rol_Cargo")) AS roles
    FROM ${SCHEMA}."Usuario" u
    INNER JOIN ${SCHEMA}."Usuario_Rol" ur
      ON ur."Id_Usuario" = u."Id_Usuario"
    INNER JOIN ${SCHEMA}."Rol" r
      ON r."Id_Rol" = ur."Id_Rol"
    LEFT JOIN ${SCHEMA}."Persona" pe
      ON pe."Id_Persona" = u."Id_Persona"
    WHERE UPPER(u."Estado_Usuario") = 'ACTIVO'
      AND UPPER(r."Rol_Cargo") IN ('TESORERO', 'PROFESOR')
    GROUP BY
      u."Id_Usuario",
      pe."Nombre",
      pe."Segundo_Nombre",
      pe."Apellido_Paterno",
      pe."Apellido_Materno"
  `;

  const result = await db.query(query);
  return result.rows;
}

module.exports = {
  listarPersonalOperativo
};
