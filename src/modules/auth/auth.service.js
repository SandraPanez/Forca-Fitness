const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authRepository = require('./auth.repository');
const ROLES = require('../../shared/constants/roles');

async function login(correo, password) {
  const usuario = await authRepository.buscarPorCorreo(correo.trim());

  if (!usuario) {
    throw new Error('CREDENCIALES_INVALIDAS');
  }

  const passwordValido = await bcrypt.compare(
    password,
    usuario.Password_Hash
  );

  if (!passwordValido) {
    throw new Error('CREDENCIALES_INVALIDAS');
  }

  const estadoUsuario = String(
    usuario.Estado_Usuario || ''
  ).toUpperCase();

  if (estadoUsuario !== 'ACTIVO') {
    const pagoPendiente =
      await authRepository.buscarMatriculaPendientePorCorreo(correo);

    const error = new Error(
      pagoPendiente
        ? 'USUARIO_PAGO_PENDIENTE'
        : 'USUARIO_NO_HABILITADO'
    );

    error.pagoPendiente = pagoPendiente;
    throw error;
  }

  const rolesValidos = Object.values(ROLES);

  const rolesUsuario = Array.isArray(usuario.Roles)
    ? usuario.Roles
        .map(rol => String(rol).toUpperCase())
        .filter(rol => rolesValidos.includes(rol))
    : [];

  if (rolesUsuario.length === 0) {
    throw new Error('ROL_INVALIDO');
  }

  // Rol principal para mantener compatibilidad con el código existente.
  // Si el usuario tiene varios roles, se usa esta prioridad.
  const prioridadRoles = [
    ROLES.DIRECTOR,
    ROLES.TESORERO,
    ROLES.PROFESOR,
    ROLES.ALUMNO
  ];

  const rolPrincipal =
    prioridadRoles.find(rol => rolesUsuario.includes(rol));

  if (!rolPrincipal) {
    throw new Error('ROL_INVALIDO');
  }

  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET_NO_CONFIGURADO');
  }

  const token = jwt.sign(
    {
      sub: usuario.Id_Usuario,

      // Compatibilidad con código existente
      rol: rolPrincipal,

      // Nuevo soporte para múltiples roles
      roles: rolesUsuario
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '8h'
    }
  );

  return {
    usuario: {
      id: usuario.Id_Usuario,
      correo: usuario.Correo,

      // Compatibilidad
      rol: rolPrincipal,

      // Todos los roles
      roles: rolesUsuario
    },
    token
  };
}

module.exports = {
  login
};