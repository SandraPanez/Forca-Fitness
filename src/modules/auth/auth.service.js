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

  // El usuario solo puede ingresar cuando su cuenta esté habilitada.
  // Al registrarse queda PENDIENTE hasta que se confirme el pago.
  const estadoUsuario = String(
    usuario.Estado_Usuario || ''
  ).toUpperCase();

  if (estadoUsuario !== 'ACTIVO') {
    const pagoPendiente = await authRepository.buscarMatriculaPendientePorCorreo(correo);
    const error = new Error(
      pagoPendiente ? 'USUARIO_PAGO_PENDIENTE' : 'USUARIO_NO_HABILITADO'
    );
    error.pagoPendiente = pagoPendiente;
    throw error;
  }

  const rolesValidos = Object.values(ROLES);

  if (!rolesValidos.includes(usuario.Rol)) {
    throw new Error('ROL_INVALIDO');
  }

  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET_NO_CONFIGURADO');
  }

  const token = jwt.sign(
    {
      sub: usuario.Id_Usuario,
      rol: usuario.Rol
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
      rol: usuario.Rol
    },
    token
  };
}

module.exports = {
  login
};