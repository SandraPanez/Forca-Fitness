
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');

const TIPO_TOKEN = 'HU22_PREVISUALIZACION';
const EMISOR = 'forca-fitness';
const DESTINATARIO = 'confirmacion-horarios';

// Crear una huella de los dias y horas solicitados.
function generarHuella(cambios) {
  const contenido = JSON.stringify({
    dias: cambios.dias,
    hora_inicio: cambios.hora_inicio,
    hora_fin: cambios.hora_fin
  });

  return crypto
    .createHash('sha256')
    .update(contenido)
    .digest('hex');
}

// Generar un token despues de validar una vista previa.
function generarTokenPreview(usuarioId, idDiscHorario, cambios) {
  if (usuarioId === undefined || usuarioId === null) {
    throw new Error('No se pudo identificar al usuario.');
  }

  return jwt.sign(
    {
      tipo: TIPO_TOKEN,
      idDiscHorario: String(idDiscHorario),
      huella: generarHuella(cambios)
    },
    process.env.JWT_SECRET,
    {
      subject: String(usuarioId),
      issuer: EMISOR,
      audience: DESTINATARIO,
      expiresIn: '10m',
      algorithm: 'HS256'
    }
  );
}

// Comprobar que el token corresponda a la confirmacion.
function verificarTokenPreview(
  token,
  usuarioId,
  idDiscHorario,
  cambios
) {
  const error = new Error(
    'Debes generar una vista previa valida antes de confirmar los cambios.'
  );

  error.statusCode = 409;

  if (!token || usuarioId === undefined || usuarioId === null) {
    throw error;
  }

  try {
    const datos = jwt.verify(
      token,
      process.env.JWT_SECRET,
      {
        issuer: EMISOR,
        audience: DESTINATARIO,
        algorithms: ['HS256']
      }
    );

    const esValido =
      datos.tipo === TIPO_TOKEN &&
      datos.sub === String(usuarioId) &&
      datos.idDiscHorario === String(idDiscHorario) &&
      datos.huella === generarHuella(cambios);

    if (!esValido) {
      throw error;
    }

    return true;

  } catch {
    throw error;
  }
}

module.exports = {
  generarTokenPreview,
  verificarTokenPreview
};
