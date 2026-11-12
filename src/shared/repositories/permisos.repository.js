const db = require('../config/database');

const SCHEMA = '"Academia Forca&Fitness"';

// Si la base todavía no tiene la tabla Usuario_Permiso (personal-permisos.schema.sql),
// se usan solo los permisos de cada rol en lugar de bloquear todo el sistema.
let avisoTablaFaltante = false;

async function consultar(texto, params) {
  try {
    return (await db.query(texto, params)).rows;
  } catch (error) {
    if (error.code === '42P01') {
      if (!avisoTablaFaltante) {
        avisoTablaFaltante = true;
        console.warn('Falta la tabla Usuario_Permiso: se aplican solo los permisos de cada rol.');
      }
      return [];
    }
    throw error;
  }
}

async function listarSobrescrituras(idUsuario) {
  return consultar(
    `SELECT "Permiso" AS permiso, "Habilitado" AS habilitado
     FROM ${SCHEMA}."Usuario_Permiso"
     WHERE "Id_Usuario" = $1`,
    [idUsuario]
  );
}

async function obtenerSobrescritura(idUsuario, permiso) {
  const filas = await consultar(
    `SELECT "Habilitado" AS habilitado
     FROM ${SCHEMA}."Usuario_Permiso"
     WHERE "Id_Usuario" = $1 AND "Permiso" = $2`,
    [idUsuario, permiso]
  );

  return filas[0]?.habilitado ?? null;
}

module.exports = {
  listarSobrescrituras,
  obtenerSobrescritura
};
