const { pool } = require("../../shared/config/database");
const SCHEMA = '"Academia Forca&Fitness"';

async function obtenerDatosAlumno(idUsuario) {
  const query = `
    SELECT
      a."Id_alumno"            AS id,
      p."Nombre"               AS nombre,
      p."Apellido_Paterno"     AS apellido_paterno,
      p."Apellido_Materno"     AS apellido_materno,
      p."Fecha_Nacimiento"     AS fecha_nacimiento,
      p."Genero"               AS genero,
      p."Direccion"            AS direccion,
      p."Numero_Documento"     AS numero_documento,
      (SELECT mc."Contacto"
       FROM ${SCHEMA}."Metodo_Contacto" mc
       WHERE mc."Id_Persona" = p."Id_Persona" AND mc."Tipo_Contacto" = 'Correo'
       LIMIT 1) AS correo_electronico,
      (SELECT mc."Contacto"
       FROM ${SCHEMA}."Metodo_Contacto" mc
       WHERE mc."Id_Persona" = p."Id_Persona" AND mc."Tipo_Contacto" = 'Celular'
       LIMIT 1) AS numero_celular
    FROM ${SCHEMA}."Alumno" a
    JOIN ${SCHEMA}."Persona" p ON p."Id_Persona" = a."Id_Persona"
    JOIN ${SCHEMA}."Usuario" u ON u."Id_Persona" = p."Id_Persona"
    WHERE u."Id_Usuario" = $1
  `;
  const result = await pool.query(query, [idUsuario]);
  console.log('Query result rows:', result.rows.length, 'idUsuario:', idUsuario);
  return result.rows[0] || null;
}

async function actualizarDatosAlumno(idUsuario, datos) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const alumno = await client.query(
      `SELECT a."Id_Persona" FROM ${SCHEMA}."Alumno" a
       JOIN ${SCHEMA}."Usuario" u ON u."Id_Persona" = a."Id_Persona"
       WHERE u."Id_Usuario" = $1`,
      [idUsuario]
    );
    const idPersona = alumno.rows[0].Id_Persona;

    await client.query(
      `UPDATE ${SCHEMA}."Persona"
       SET "Nombre"           = $1,
           "Apellido_Paterno" = $2,
           "Apellido_Materno" = $3,
           "Fecha_Nacimiento" = $4,
           "Genero"           = $5,
           "Direccion"        = $6
       WHERE "Id_Persona" = $7`,
      [datos.nombre, datos.apellido_paterno, datos.apellido_materno,
       datos.fecha_nacimiento, datos.genero, datos.direccion, idPersona]
    );

    if (datos.correo_electronico !== undefined) {
      const existe = await client.query(
        `SELECT "Id_contacto" FROM ${SCHEMA}."Metodo_Contacto"
         WHERE "Id_Persona" = $1 AND "Tipo_Contacto" = 'Correo'`,
        [idPersona]
      );
      if (existe.rows.length > 0) {
        await client.query(
          `UPDATE ${SCHEMA}."Metodo_Contacto" SET "Contacto" = $1
           WHERE "Id_Persona" = $2 AND "Tipo_Contacto" = 'Correo'`,
          [datos.correo_electronico, idPersona]
        );
      } else {
        const count = await client.query(`SELECT COUNT(*) FROM ${SCHEMA}."Metodo_Contacto"`);
        const nuevoId = `MC${String(parseInt(count.rows[0].count) + 1).padStart(2, "0")}`;
        await client.query(
          `INSERT INTO ${SCHEMA}."Metodo_Contacto" ("Id_contacto","Tipo_Contacto","Contacto","Id_Persona")
           VALUES ($1, 'Correo', $2, $3)`,
          [nuevoId, datos.correo_electronico, idPersona]
        );
      }
    }

    if (datos.numero_celular !== undefined) {
      const existe = await client.query(
        `SELECT "Id_contacto" FROM ${SCHEMA}."Metodo_Contacto"
         WHERE "Id_Persona" = $1 AND "Tipo_Contacto" = 'Celular'`,
        [idPersona]
      );
      if (existe.rows.length > 0) {
        await client.query(
          `UPDATE ${SCHEMA}."Metodo_Contacto" SET "Contacto" = $1
           WHERE "Id_Persona" = $2 AND "Tipo_Contacto" = 'Celular'`,
          [datos.numero_celular, idPersona]
        );
      } else {
        const count = await client.query(`SELECT COUNT(*) FROM ${SCHEMA}."Metodo_Contacto"`);
        const nuevoId = `MC${String(parseInt(count.rows[0].count) + 2).padStart(2, "0")}`;
        await client.query(
          `INSERT INTO ${SCHEMA}."Metodo_Contacto" ("Id_contacto","Tipo_Contacto","Contacto","Id_Persona")
           VALUES ($1, 'Celular', $2, $3)`,
          [nuevoId, datos.numero_celular, idPersona]
        );
      }
    }

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