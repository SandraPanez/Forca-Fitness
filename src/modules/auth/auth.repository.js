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

module.exports = {
  buscarPorCorreo
};