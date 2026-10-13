const profesoresRepository = require('./profesores.repository');
const alumnosService = require('../alumnos/alumnos.service');

async function obtenerPerfil(idUsuario) {
  return profesoresRepository.buscarPorUsuarioId(idUsuario);
}

async function listarAlumnos(idUsuario) {
  const profesor = await obtenerPerfil(idUsuario);

  if (!profesor) {
    return null;
  }

  return {
    profesor,
    alumnos: await alumnosService.listarAlumnos(profesor.id)
  };
}

async function obtenerDetalleAlumno(idUsuario, idAlumno) {
  const profesor = await obtenerPerfil(idUsuario);

  if (!profesor) {
    return null;
  }

  return alumnosService.obtenerDetalleAlumno(idAlumno, profesor.id);
}

module.exports = {
  obtenerPerfil,
  listarAlumnos,
  obtenerDetalleAlumno
};
