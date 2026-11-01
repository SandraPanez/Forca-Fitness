const db = require('../config/database');

const SCHEMA = '"Academia Forca&Fitness"';

async function listarSobrescrituras(idUsuario) {
  const result = await db.query(
    `SELECT "Permiso" AS permiso, "Habilitado" AS habilitado
     FROM ${SCHEMA}."Usuario_Permiso"
     WHERE "Id_Usuario" = $1`,
    [idUsuario]
  );

  return result.rows;
}

async function obtenerSobrescritura(idUsuario, permiso) {
  const result = await db.query(
    `SELECT "Habilitado" AS habilitado
     FROM ${SCHEMA}."Usuario_Permiso"
     WHERE "Id_Usuario" = $1 AND "Permiso" = $2`,
    [idUsuario, permiso]
  );

  return result.rows[0]?.habilitado ?? null;
}

module.exports = {
  listarSobrescrituras,
  obtenerSobrescritura
};
