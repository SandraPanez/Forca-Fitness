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

    if (error.message === 'USUARIO_PAGO_PENDIENTE') {
      return res.status(403).json({
        message: 'Tu matrícula tiene un pago pendiente. Puedes continuar el pago con Mercado Pago.',
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