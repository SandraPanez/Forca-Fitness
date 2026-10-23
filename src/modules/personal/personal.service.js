const personalRepository = require('./personal.repository');
const ROLES = require('../../shared/constants/roles');
const { PERMISOS, PERMISOS_POR_ROL } = require('../../shared/constants/permisos');

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

  return {
    ...persona,
    nombre: persona.nombre || 'Sin nombre registrado',
    permisos: [...new Set(persona.roles.flatMap(rol => PERMISOS_POR_ROL[rol] || []))],
    permisosDisponibles: Object.values(PERMISOS),
    disciplinas: persona.roles.includes(ROLES.PROFESOR) ? persona.disciplinas : []
  };
}

module.exports = {
  listarPersonal,
  obtenerDetalle
};
