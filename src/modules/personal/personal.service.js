const personalRepository = require('./personal.repository');
const ROLES = require('../../shared/constants/roles');

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

module.exports = {
  listarPersonal
};
