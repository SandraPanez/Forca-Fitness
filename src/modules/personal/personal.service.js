const personalRepository = require('./personal.repository');
const authRepository = require('../auth/auth.repository');
const ROLES = require('../../shared/constants/roles');
const { PERMISOS, PERMISOS_POR_ROL } = require('../../shared/constants/permisos');
const permisosRepository = require('../../shared/repositories/permisos.repository');
const bcrypt = require('bcryptjs');

async function inactivarPersonal(idUsuario, idDirector) {
  if (typeof idUsuario !== 'string' || !idUsuario.trim() || idUsuario.length > 10) {
    throw Object.assign(new Error('El identificador del trabajador no es válido.'), { status: 400 });
  }
  if (idUsuario === idDirector) {
    throw Object.assign(new Error('No puedes dar de baja a tu propia cuenta.'), { status: 403 });
  }
  return personalRepository.inactivarPersonal(idUsuario);
}

async function validarRegistro(datos) {
  function rechazar(campo, mensaje, status = 400) {
    const error = new Error(mensaje);
    error.status = status;
    error.campo = campo;
    throw error;
  }

  const etiquetas = {
    nombres: 'Los nombres',
    apellido_paterno: 'El apellido paterno',
    apellido_materno: 'El apellido materno',
    numero_documento: 'El DNI',
    correo_electronico: 'El correo electrónico',
    numero_celular: 'El número de celular',
    fecha_nacimiento: 'La fecha de nacimiento',
    genero: 'El género',
    direccion: 'La dirección',
    password: 'La contraseña temporal'
  };
  const campos = {};

  for (const [campo, etiqueta] of Object.entries(etiquetas)) {
    if (typeof datos?.[campo] !== 'string' || !datos[campo].trim()) {
      rechazar(campo, `${etiqueta}: completa este campo obligatorio.`);
    }
    campos[campo] = campo === 'password' ? datos[campo] : datos[campo].trim();
  }

  const [nombre, ...otrosNombres] = campos.nombres.split(/\s+/);
  if (nombre.length > 40 || otrosNombres.join(' ').length > 40) {
    rechazar('nombres', 'El primer nombre y los demás nombres admiten hasta 40 caracteres cada uno.');
  }
  for (const campo of ['apellido_paterno', 'apellido_materno']) {
    if (campos[campo].length > 20) {
      rechazar(campo, `${etiquetas[campo]} admite hasta 20 caracteres.`);
    }
  }
  if (!/^[0-9]{8}$/.test(campos.numero_documento)) {
    rechazar('numero_documento', 'El DNI debe tener 8 dígitos.');
  }
  if (campos.correo_electronico.length > 50 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(campos.correo_electronico)) {
    rechazar('correo_electronico', 'Ingresa un correo electrónico válido de hasta 50 caracteres.');
  }
  if (!/^[0-9]{9}$/.test(campos.numero_celular)) {
    rechazar('numero_celular', 'El número de celular debe tener 9 dígitos.');
  }
  const fecha = new Date(campos.fecha_nacimiento);
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(campos.fecha_nacimiento) || Number.isNaN(fecha.getTime()) ||
      fecha.toISOString().slice(0, 10) !== campos.fecha_nacimiento ||
      campos.fecha_nacimiento < '1930-01-01' || campos.fecha_nacimiento > hoy) {
    rechazar('fecha_nacimiento', 'Ingresa una fecha de nacimiento válida, sin fechas futuras.');
  }
  if (!['M', 'F', 'OTRO'].includes(campos.genero)) {
    rechazar('genero', 'Selecciona un género válido.');
  }
  if (campos.direccion.length > 50) {
    rechazar('direccion', 'La dirección admite hasta 50 caracteres.');
  }
  if (campos.password.length < 6) {
    rechazar('password', 'La contraseña temporal debe tener al menos 6 caracteres.');
  }
  if (Buffer.byteLength(campos.password, 'utf8') > 72) {
    rechazar('password', 'La contraseña temporal es demasiado larga. Usa una más corta.');
  }
  if (!Array.isArray(datos.roles) || datos.roles.length === 0 ||
      new Set(datos.roles).size !== datos.roles.length ||
      datos.roles.some(rol => ![ROLES.PROFESOR, ROLES.TESORERO].includes(rol))) {
    rechazar('roles', 'Selecciona al menos un rol válido: Profesor o Tesorero.');
  }

  campos.correo_electronico = campos.correo_electronico.toLowerCase();
  if (await authRepository.buscarPorCorreo(campos.correo_electronico)) {
    rechazar('correo_electronico', 'El correo electrónico ya está registrado.', 409);
  }
  return { ...campos, roles: [...datos.roles] };
}

async function crearPersonal(datos) {
  const { password, ...campos } = await validarRegistro(datos);
  const passwordHash = await bcrypt.hash(password, 10);
  return personalRepository.crearPersonal(campos, passwordHash);
}

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
  inactivarPersonal,
  crearPersonal,
  validarRegistro,
  listarPersonal,
  obtenerDetalle,
  actualizarAccesos
};
