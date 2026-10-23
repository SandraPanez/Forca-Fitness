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

// Datos de una cuenta del personal operativo. El correo es el contacto registrado y,
// si la persona no tiene uno, el de la cuenta con la que inicia sesión.
async function obtenerDetallePersonal(idUsuario) {
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
      NULLIF(BTRIM(pe."Nombre"), '') AS nombres,
      NULLIF(BTRIM(pe."Segundo_Nombre"), '') AS segundo_nombre,
      NULLIF(BTRIM(pe."Apellido_Paterno"), '') AS apellido_paterno,
      NULLIF(BTRIM(pe."Apellido_Materno"), '') AS apellido_materno,
      ARRAY(
        SELECT DISTINCT UPPER(r."Rol_Cargo")
        FROM ${SCHEMA}."Usuario_Rol" ur
        INNER JOIN ${SCHEMA}."Rol" r ON r."Id_Rol" = ur."Id_Rol"
        WHERE ur."Id_Usuario" = u."Id_Usuario"
          AND UPPER(r."Rol_Cargo") IN ('TESORERO', 'PROFESOR')
        ORDER BY 1
      ) AS roles,
      di."Tipo_Documento" AS tipo_documento,
      pe."Numero_Documento" AS documento,
      COALESCE(
        (
          SELECT mc."Contacto"
          FROM ${SCHEMA}."Metodo_Contacto" mc
          WHERE mc."Id_Persona" = pe."Id_Persona"
            AND UPPER(mc."Tipo_Contacto") = 'CORREO'
          ORDER BY mc."Id_contacto" DESC
          LIMIT 1
        ),
        u."Correo"
      ) AS correo,
      (
        SELECT mc."Contacto"
        FROM ${SCHEMA}."Metodo_Contacto" mc
        WHERE mc."Id_Persona" = pe."Id_Persona"
          AND UPPER(mc."Tipo_Contacto") = 'CELULAR'
        ORDER BY mc."Id_contacto" DESC
        LIMIT 1
      ) AS telefono,
      ARRAY(
        SELECT DISTINCT d."Nombre_Disciplina"
        FROM ${SCHEMA}."Profesor" p
        INNER JOIN ${SCHEMA}."Disciplina_Horario" dh ON dh."Id_Profesor" = p."Id_Profesor"
        INNER JOIN ${SCHEMA}."Disciplina" d ON d."Id_Disciplinas" = dh."Id_Disciplina"
        WHERE p."Id_Persona" = u."Id_Persona"
        ORDER BY 1
      ) AS disciplinas
    FROM ${SCHEMA}."Usuario" u
    LEFT JOIN ${SCHEMA}."Persona" pe
      ON pe."Id_Persona" = u."Id_Persona"
    LEFT JOIN ${SCHEMA}."Documento_Identificacion" di
      ON di."Id_Documento" = pe."Id_Documento"
    WHERE u."Id_Usuario" = $1
      AND UPPER(u."Estado_Usuario") = 'ACTIVO'
      AND EXISTS (
        SELECT 1
        FROM ${SCHEMA}."Usuario_Rol" ur
        INNER JOIN ${SCHEMA}."Rol" r ON r."Id_Rol" = ur."Id_Rol"
        WHERE ur."Id_Usuario" = u."Id_Usuario"
          AND UPPER(r."Rol_Cargo") IN ('TESORERO', 'PROFESOR')
      )
  `;

  const result = await db.query(query, [idUsuario]);
  return result.rows[0] || null;
}

module.exports = {
  listarPersonalOperativo,
  obtenerDetallePersonal
};
