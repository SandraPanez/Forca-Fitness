const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authRepository = require('./auth.repository');

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

  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET_NO_CONFIGURADO');
  }

  const token = jwt.sign(
    {
      sub: usuario.Id_Usuario
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '8h'
    }
  );

  return {
    usuario: {
      id: usuario.Id_Usuario,
      correo: usuario.Correo
    },
    token
  };
}

module.exports = {
  login
};