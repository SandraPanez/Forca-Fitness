const { pool } = require("../../shared/config/database");
const matriculasRepository = require('../matriculas/matriculas.repository');
const SCHEMA = '"Academia Forca&Fitness"';

async function obtenerDatosAlumno(idUsuario) {
  const query = `
    SELECT
      a."Id_alumno"            AS id,
      TRIM(CONCAT_WS(' ', p."Nombre", p."Segundo_Nombre")) AS nombre,
      p."Apellido_Paterno"     AS apellido_paterno,
      p."Apellido_Materno"     AS apellido_materno,
      p."Fecha_Nacimiento"     AS fecha_nacimiento,
      p."Genero"               AS genero,
      p."Direccion"            AS direccion,
      p."Numero_Documento"     AS numero_documento,
      COALESCE(
        NULLIF(TRIM((SELECT mc."Contacto"
         FROM ${SCHEMA}."Metodo_Contacto" mc
         WHERE mc."Id_Persona" = p."Id_Persona" AND UPPER(mc."Tipo_Contacto") = 'CORREO'
           AND NULLIF(TRIM(mc."Contacto"), '') IS NOT NULL
         ORDER BY (mc."Tipo_Contacto" = 'CORREO') DESC, mc."Id_contacto"
         LIMIT 1)), ''),
        u."Correo"
      ) AS correo_electronico,
      NULLIF(TRIM((SELECT mc."Contacto"
       FROM ${SCHEMA}."Metodo_Contacto" mc
       WHERE mc."Id_Persona" = p."Id_Persona" AND UPPER(mc."Tipo_Contacto") = 'CELULAR'
         AND NULLIF(TRIM(mc."Contacto"), '') IS NOT NULL
       ORDER BY (mc."Tipo_Contacto" = 'CELULAR') DESC, mc."Id_contacto"
       LIMIT 1)), '') AS numero_celular
    FROM ${SCHEMA}."Alumno" a
    JOIN ${SCHEMA}."Persona" p ON p."Id_Persona" = a."Id_Persona"
    JOIN ${SCHEMA}."Usuario" u ON u."Id_Persona" = p."Id_Persona"
    WHERE u."Id_Usuario" = $1
  `;
  const result = await pool.query(query, [idUsuario]);
  return result.rows[0] || null;
}

async function actualizarDatosAlumno(idUsuario, datos) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const alumno = await client.query(
      `SELECT a."Id_Persona" FROM ${SCHEMA}."Alumno" a
       JOIN ${SCHEMA}."Usuario" u ON u."Id_Persona" = a."Id_Persona"
       WHERE u."Id_Usuario" = $1
       FOR UPDATE OF a`,
      [idUsuario]
    );
    if (!alumno.rows[0]) throw new Error("Alumno no encontrado");
    const idPersona = alumno.rows[0].Id_Persona;
    const [nombre, ...otrosNombres] = datos.nombre.trim().split(/\s+/);

    await client.query(
      `UPDATE ${SCHEMA}."Persona"
       SET "Nombre"           = $1,
           "Segundo_Nombre"   = $2,
           "Apellido_Paterno" = $3,
           "Apellido_Materno" = $4,
           "Fecha_Nacimiento" = $5,
           "Genero"           = $6,
           "Direccion"        = $7
       WHERE "Id_Persona" = $8`,
      [nombre, otrosNombres.join(' ') || null, datos.apellido_paterno, datos.apellido_materno,
       datos.fecha_nacimiento, datos.genero, datos.direccion, idPersona]
    );

    if (datos.correo_electronico !== undefined) {
      await client.query(
        `UPDATE ${SCHEMA}."Usuario" SET "Correo" = $1 WHERE "Id_Usuario" = $2`,
        [datos.correo_electronico, idUsuario]
      );
    }

    await matriculasRepository.guardarContactos(idPersona, datos, client);

    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { obtenerDatosAlumno, actualizarDatosAlumno };
