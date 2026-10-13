const profesoresService = require('./profesores.service');

async function obtenerPerfil(req, res) {
  try {
    const profesor = await profesoresService.obtenerPerfil(req.user.id);

    if (!profesor) {
      return res.status(404).json({
        success: false,
        message: 'El usuario no tiene un perfil de profesor asociado'
      });
    }

    return res.status(200).json({
      success: true,
      data: profesor
    });
  } catch (error) {
    console.error('Error al obtener perfil del profesor:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al obtener el perfil del profesor'
    });
  }
}

async function listarAlumnos(req, res) {
  try {
    const resultado = await profesoresService.listarAlumnos(req.user.id);

    if (!resultado) {
      return res.status(404).json({
        success: false,
        message: 'El usuario no tiene un perfil de profesor asociado'
      });
    }

    return res.status(200).json({
      success: true,
      data: resultado.alumnos
    });
  } catch (error) {
    console.error('Error al obtener alumnos del profesor:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al obtener alumnos del profesor'
    });
  }
}

async function obtenerDetalleAlumno(req, res) {
  try {
    const detalle = await profesoresService.obtenerDetalleAlumno(
      req.user.id,
      req.params.id
    );

    if (!detalle) {
      return res.status(404).json({
        success: false,
        message: 'Alumno no encontrado en las disciplinas asignadas al profesor'
      });
    }

    return res.status(200).json({
      success: true,
      data: detalle
    });
  } catch (error) {
    console.error('Error al obtener detalle de alumno del profesor:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al obtener el detalle del alumno'
    });
  }
}

module.exports = {
  obtenerPerfil,
  listarAlumnos,
  obtenerDetalleAlumno
};
