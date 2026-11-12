const jwt = require('jsonwebtoken');
const authRepository = require('../../modules/auth/auth.repository');
const ROLES = require('../constants/roles');

async function autenticar(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({
      message: 'Token de autenticación requerido'
    });
  }

  const token = authorization.substring(7);

  let payload;
  try {
    payload = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    if (typeof payload.sub !== 'string' || !payload.sub) throw new Error('Sesión sin usuario');
  } catch (error) {
    return res.status(401).json({
      message: 'Token inválido o expirado'
    });
  }

  try {
    const usuario = await authRepository.buscarSesionPorId(payload.sub);
    if (!usuario || String(usuario.Estado_Usuario).toUpperCase() !== 'ACTIVO') {
      return res.status(401).json({ message: 'La cuenta no está activa. Inicia sesión con una cuenta habilitada.' });
    }
    const rolesValidos = Object.values(ROLES);
    const roles = (Array.isArray(usuario.Roles) ? usuario.Roles : [])
      .map(rol => String(rol).toUpperCase()).filter(rol => rolesValidos.includes(rol));
    if (!roles.length) {
      return res.status(401).json({ message: 'La cuenta no tiene un rol habilitado.' });
    }
    req.user = { id: usuario.Id_Usuario, rol: rolesValidos.find(rol => roles.includes(rol)), roles };
    return next();
  } catch (error) {
    console.error('Error al verificar la cuenta de la sesión:', error);
    return res.status(503).json({ message: 'No se pudo verificar la sesión. Inténtalo nuevamente.' });
  }
}

module.exports = {
  autenticar
};
