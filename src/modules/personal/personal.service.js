const personalRepository = require('./personal.repository');
const ROLES = require('../../shared/constants/roles');
const { PERMISOS, PERMISOS_POR_ROL } = require('../../shared/constants/permisos');
const permisosRepository = require('../../shared/repositories/permisos.repository');

// Tesoreros primero y, dentro de cada grupo, orden alfabético por el nombre que se muestra.
// Se ordena aquí y no en SQL para que las tildes y mayúsculas no alteren el orden.
async function listarPersonal() {
  const personal = await personalRepository.listarPersonalOperativo();

  return personal
    .map(persona => ({
      ...persona,
      nombre: persona.nombre || 'Sin nombre registrado'
    }))
    .sort((a, b) => {
      const esTesoreroA = a.roles.includes(ROLES.TESORERO);
      const esTesoreroB = b.roles.includes(ROLES.TESORERO);

      if (esTesoreroA !== esTesoreroB) {
        return esTesoreroA ? -1 : 1;
      }

      return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
    });
}

// Información detallada de un trabajador. Las disciplinas solo aplican a quien es profesor.
async function obtenerDetalle(idUsuario) {
  const persona = await personalRepository.obtenerDetallePersonal(idUsuario);

  if (!persona) {
    return null;
  }

  const sobrescrituras = await permisosRepository.listarSobrescrituras(idUsuario);
  const permisosGuardados = new Map(
    sobrescrituras.map(({ permiso, habilitado }) => [permiso, habilitado])
  );
  const permisosPorRol = new Set(
    persona.roles.flatMap(rol => PERMISOS_POR_ROL[rol] || [])
  );

  return {
    ...persona,
    nombre: persona.nombre || 'Sin nombre registrado',
    permisos: Object.values(PERMISOS).filter(permiso =>
      permisosGuardados.has(permiso)
        ? permisosGuardados.get(permiso)
        : permisosPorRol.has(permiso)
    ),
    permisosDisponibles: Object.values(PERMISOS),
    disciplinas: persona.roles.includes(ROLES.PROFESOR) ? persona.disciplinas : []
  };
}

async function actualizarAccesos(idUsuario, datos) {
  if (!datos || !Array.isArray(datos.roles) || !Array.isArray(datos.permisos)) {
    const error = new Error('Debe enviar roles y permisos válidos.');
    error.status = 400;
    throw error;
  }

  const rolesPermitidos = [ROLES.PROFESOR, ROLES.TESORERO];
  const roles = [...new Set(datos.roles)];
  const permisosPermitidos = Object.values(PERMISOS);
  const permisos = [...new Set(datos.permisos)];

  if (
    roles.length === 0 ||
    roles.length !== datos.roles.length ||
    roles.some(rol => !rolesPermitidos.includes(rol))
  ) {
    const error = new Error('El trabajador debe mantener al menos un rol operativo válido.');
    error.status = 400;
    throw error;
  }

  if (
    permisos.length !== datos.permisos.length ||
    permisos.some(permiso => !permisosPermitidos.includes(permiso))
  ) {
    const error = new Error('La lista de permisos contiene valores inválidos o repetidos.');
    error.status = 400;
    throw error;
  }

  await personalRepository.guardarAccesos(idUsuario, roles, permisos);
  return { mensaje: 'Roles y permisos guardados correctamente.' };
}

module.exports = {
  listarPersonal,
  obtenerDetalle,
  actualizarAccesos
};
