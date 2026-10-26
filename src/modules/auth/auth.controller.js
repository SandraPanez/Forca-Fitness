const authService = require('./auth.service');

const AUTH_COOKIE_NAME = 'forca_auth_token';

function getCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
}

async function login(req, res) {
  try {
    const { correo, password } = req.body;

    if (!correo || !password) {
      return res.status(400).json({
        message: 'Correo y contraseña son obligatorios'
      });
    }

    const resultado = await authService.login(
      correo,
      password
    );

    res.cookie(AUTH_COOKIE_NAME, resultado.token, {
      ...getCookieOptions(),
      maxAge: 8 * 60 * 60 * 1000
    });

    return res.status(200).json(resultado);

  } catch (error) {

    if (error.message === 'CREDENCIALES_INVALIDAS') {
      return res.status(401).json({
        message: 'Credenciales incorrectas'
      });
    }

    if (error.message === 'USUARIO_INACTIVO') {
      return res.status(403).json({ message: 'Tu cuenta está inactiva. Contacta con la administración.' });
    }

    if (error.message === 'USUARIO_PAGO_PENDIENTE') {
      const esEfectivo = String(error.pagoPendiente?.medio_pago || '').toUpperCase() === 'EFECTIVO';
      const mensaje = esEfectivo
        ? 'Tu matrícula está pendiente de confirmación de pago en efectivo. Por favor, acércate a recepción para que el tesorero apruebe tu pago y se habilite tu cuenta.'
        : 'Tu matrícula tiene un pago pendiente. El pago debe ser completado para habilitar tu cuenta.';
      return res.status(403).json({
        message: mensaje,
        pagoPendiente: error.pagoPendiente
      });
    }

    if (error.message === 'USUARIO_NO_HABILITADO') {
      return res.status(403).json({
        message:
          'Tu cuenta aún no está habilitada. El pago de la matrícula debe ser confirmado.'
      });
    }

    console.error(
      'Error en autenticación:',
      error
    );

    return res.status(500).json({
      message: 'Error interno del servidor'
    });
  }
}

function logout(req, res) {
  res.clearCookie(
    AUTH_COOKIE_NAME,
    getCookieOptions()
  );

  return res.status(200).json({
    message: 'Sesión cerrada correctamente'
  });
}

module.exports = {
  login,
  logout
};
