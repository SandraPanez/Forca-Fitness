const db = require('../../shared/config/database');
const { PERMISOS } = require('../../shared/constants/permisos');

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

async function guardarAccesos(idUsuario, roles, permisosActivos) {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const usuario = await client.query(
      `SELECT u."Id_Usuario"
       FROM ${SCHEMA}."Usuario" u
       WHERE u."Id_Usuario" = $1
         AND UPPER(u."Estado_Usuario") = 'ACTIVO'
         AND EXISTS (
           SELECT 1
           FROM ${SCHEMA}."Usuario_Rol" ur
           INNER JOIN ${SCHEMA}."Rol" r ON r."Id_Rol" = ur."Id_Rol"
           WHERE ur."Id_Usuario" = u."Id_Usuario"
             AND UPPER(r."Rol_Cargo") IN ('TESORERO', 'PROFESOR')
         )
       FOR UPDATE OF u`,
      [idUsuario]
    );

    if (!usuario.rows[0]) {
      const error = new Error('Trabajador no encontrado en el personal operativo.');
      error.status = 404;
      throw error;
    }

    const rolesCatalogo = await client.query(
      `SELECT "Id_Rol", UPPER("Rol_Cargo") AS rol
       FROM ${SCHEMA}."Rol"
       WHERE UPPER("Rol_Cargo") = ANY($1::text[])`,
      [roles]
    );

    if (rolesCatalogo.rows.length !== roles.length) {
      throw new Error('No se encontraron todos los roles solicitados en el catálogo.');
    }

    await client.query(
      `DELETE FROM ${SCHEMA}."Usuario_Rol" ur
       USING ${SCHEMA}."Rol" r
       WHERE ur."Id_Usuario" = $1
         AND ur."Id_Rol" = r."Id_Rol"
         AND UPPER(r."Rol_Cargo") IN ('TESORERO', 'PROFESOR')`,
      [idUsuario]
    );

    for (const rol of rolesCatalogo.rows) {
      await client.query(
        `INSERT INTO ${SCHEMA}."Usuario_Rol" ("Id_Usuario", "Id_Rol")
         VALUES ($1, $2)`,
        [idUsuario, rol.Id_Rol]
      );
    }

    const permisosSeleccionados = new Set(permisosActivos);
    for (const permiso of Object.values(PERMISOS)) {
      await client.query(
        `INSERT INTO ${SCHEMA}."Usuario_Permiso" ("Id_Usuario", "Permiso", "Habilitado")
         VALUES ($1, $2, $3)
         ON CONFLICT ("Id_Usuario", "Permiso")
         DO UPDATE SET "Habilitado" = EXCLUDED."Habilitado"`,
        [idUsuario, permiso, permisosSeleccionados.has(permiso)]
      );
    }

    await client.query('COMMIT');
    return true;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error al revertir la actualización de accesos:', rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  listarPersonalOperativo,
  obtenerDetallePersonal,
  guardarAccesos
};
