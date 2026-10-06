const jwt = require('jsonwebtoken');

function autenticar(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({
      message: 'Token de autenticación requerido'
    });
  }

  const token = authorization.substring(7);

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const roles = Array.isArray(payload.roles)
      ? payload.roles
      : payload.rol
        ? [payload.rol]
        : [];

    req.user = {
      id: payload.sub,

      // Compatibilidad con código anterior
      rol: payload.rol || roles[0] || null,

      // Nuevo soporte multirrol
      roles
    };

    return next();

  } catch (error) {
    return res.status(401).json({
      message: 'Token inválido o expirado'
    });
  }
}

module.exports = {
  autenticar
};