const db = require('../../shared/config/database');
const { PERMISOS } = require('../../shared/constants/permisos');
const matriculasRepository = require('../matriculas/matriculas.repository');
const ROLES = require('../../shared/constants/roles');

const SCHEMA = '"Academia Forca&Fitness"';

async function inactivarPersonal(idUsuario) {
  const client = await db.pool.connect();
  const rechazar = (status, mensaje) => Object.assign(new Error(mensaje), { status });
  try {
    await client.query('BEGIN');
    const cuenta = await client.query(
      `SELECT "Id_Usuario", "Estado_Usuario" FROM ${SCHEMA}."Usuario" WHERE "Id_Usuario" = $1 FOR UPDATE`,
      [idUsuario]
    );
    if (!cuenta.rows[0]) throw rechazar(404, 'Trabajador no encontrado.');
    const catalogo = await client.query(
      `SELECT UPPER(r."Rol_Cargo") AS rol FROM ${SCHEMA}."Usuario_Rol" ur
       JOIN ${SCHEMA}."Rol" r ON r."Id_Rol" = ur."Id_Rol" WHERE ur."Id_Usuario" = $1`, [idUsuario]
    );
    const roles = catalogo.rows.map(fila => fila.rol);
    if (roles.includes(ROLES.DIRECTOR)) {
      throw rechazar(403, 'Las cuentas de Director están protegidas frente a esta operación.');
    }
    if (!roles.some(rol => [ROLES.PROFESOR, ROLES.TESORERO].includes(rol))) {
      throw rechazar(404, 'Trabajador no encontrado en el personal operativo.');
    }
    if (String(cuenta.rows[0].Estado_Usuario).toUpperCase() !== 'INACTIVO') {
      await client.query(`UPDATE ${SCHEMA}."Usuario" SET "Estado_Usuario" = 'INACTIVO' WHERE "Id_Usuario" = $1`, [idUsuario]);
    }
    await client.query('COMMIT');
    return { id: idUsuario, estado: 'INACTIVO' };
  } catch (error) {
    try { await client.query('ROLLBACK'); }
    catch (rollbackError) { console.error('Error al revertir la baja de personal:', rollbackError); }
    throw error;
  } finally {
    client.release();
  }
}

async function crearPersonal(datos, passwordHash) {
  const client = await db.pool.connect();
  const conflicto = (campo, mensaje) => Object.assign(new Error(mensaje), { status: 409, campo });
  try {
    await client.query('BEGIN');
    for (const clave of [`personal_correo:${datos.correo_electronico}`, `personal_dni:${datos.numero_documento}`]) {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [clave]);
    }
    const correo = await client.query(
      `SELECT 1 FROM ${SCHEMA}."Usuario" WHERE LOWER("Correo") = LOWER($1) LIMIT 1`,
      [datos.correo_electronico]
    );
    if (correo.rows.length) throw conflicto('correo_electronico', 'El correo electrónico ya está registrado.');
    const documento = await client.query(
      `SELECT 1 FROM ${SCHEMA}."Persona" WHERE "Numero_Documento" = $1 LIMIT 1`, [datos.numero_documento]
    );
    if (documento.rows.length) throw conflicto('numero_documento', 'El DNI ya está registrado. Revisa la ficha existente.');

    const tipoDocumento = await client.query(
      `SELECT "Id_Documento" FROM ${SCHEMA}."Documento_Identificacion" WHERE UPPER("Tipo_Documento") = 'DNI'`
    );
    const roles = await client.query(
      `SELECT "Id_Rol" FROM ${SCHEMA}."Rol" WHERE UPPER("Rol_Cargo") = ANY($1::text[])`, [datos.roles]
    );
    if (tipoDocumento.rows.length !== 1 || roles.rows.length !== datos.roles.length) {
      throw new Error('El catálogo de documentos o roles está incompleto.');
    }
    const idPersona = await matriculasRepository.generateId(client, 'Persona', 'Id_Persona', 'PERADM');
    const [nombre, ...otrosNombres] = datos.nombres.split(/\s+/);
    await client.query(
      `INSERT INTO ${SCHEMA}."Persona"
       ("Id_Persona", "Nombre", "Segundo_Nombre", "Apellido_Paterno", "Apellido_Materno",
        "Fecha_Nacimiento", "Genero", "Direccion", "Numero_Documento", "Id_Documento")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [idPersona, nombre, otrosNombres.join(' ') || null, datos.apellido_paterno, datos.apellido_materno,
        datos.fecha_nacimiento, datos.genero, datos.direccion, datos.numero_documento, tipoDocumento.rows[0].Id_Documento]
    );
    await matriculasRepository.guardarContactos(idPersona, datos, client);
    const idUsuario = await matriculasRepository.generateId(client, 'Usuario', 'Id_Usuario', 'USU');
    await client.query(
      `INSERT INTO ${SCHEMA}."Usuario" ("Id_Usuario", "Correo", "Password_Hash", "Estado_Usuario", "Id_Persona")
       VALUES ($1,$2,$3,'ACTIVO',$4)`, [idUsuario, datos.correo_electronico, passwordHash, idPersona]
    );
    for (const rol of roles.rows) {
      await client.query(`INSERT INTO ${SCHEMA}."Usuario_Rol" ("Id_Usuario", "Id_Rol") VALUES ($1,$2)`,
        [idUsuario, rol.Id_Rol]);
    }
    if (datos.roles.includes(ROLES.PROFESOR)) {
      const idProfesor = await matriculasRepository.generateId(client, 'Profesor', 'Id_Profesor', 'PROF');
      await client.query(`INSERT INTO ${SCHEMA}."Profesor" ("Id_Profesor", "Id_Persona") VALUES ($1,$2)`,
        [idProfesor, idPersona]);
    }
    await client.query('COMMIT');
    return { id: idUsuario };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error al revertir el alta de personal:', rollbackError);
    }
    if (error.code === '23505' && /correo/i.test(error.constraint || '')) {
      throw conflicto('correo_electronico', 'El correo electrónico ya está registrado.');
    }
    throw error;
  } finally {
    client.release();
  }
}

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
  inactivarPersonal,
  crearPersonal,
  listarPersonalOperativo,
  obtenerDetallePersonal,
  guardarAccesos
};
