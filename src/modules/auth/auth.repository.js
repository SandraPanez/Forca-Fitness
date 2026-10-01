const db = require('../../shared/config/database');

async function buscarPorCorreo(correo) {
  const query = `
    SELECT
      "Id_Usuario",
      "Correo",
      "Password_Hash",
      "Estado_Usuario"
    FROM "Academia Forca&Fitness"."Usuario"
    WHERE LOWER("Correo") = LOWER($1)
    LIMIT 1
  `;

  const result = await db.query(query, [correo]);

  return result.rows[0] || null;
}

module.exports = {
  buscarPorCorreo
};