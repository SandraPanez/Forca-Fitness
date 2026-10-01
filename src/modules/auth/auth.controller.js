const authService = require('./auth.service');

async function login(req, res) {
  try {
    const { correo, password } = req.body;

    if (!correo || !password) {
      return res.status(400).json({
        message: 'Correo y contraseña son obligatorios'
      });
    }

    const resultado = await authService.login(correo, password);

    return res.status(200).json(resultado);
  } catch (error) {
    if (error.message === 'CREDENCIALES_INVALIDAS') {
      return res.status(401).json({
        message: 'Credenciales incorrectas'
      });
    }

    console.error('Error en autenticación:', error);

    return res.status(500).json({
      message: 'Error interno del servidor'
    });
  }
}

module.exports = {
  login
};