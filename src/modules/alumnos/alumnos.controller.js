const alumnosService = require('./alumnos.service');

class AlumnosController {
  async listarAlumnos(req, res) {
    try {
      const alumnos = await alumnosService.listarAlumnos();
      return res.status(200).json({
        success: true,
        data: alumnos
      });
    } catch (error) {
      console.error('Error en listarAlumnos:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno al obtener alumnos'
      });
    }
  }

  async obtenerDetalleAlumno(req, res) {
    try {
      const { id } = req.params;
      const detalle = await alumnosService.obtenerDetalleAlumno(id);
      
      if (!detalle) {
        return res.status(404).json({
          success: false,
          message: 'Alumno no encontrado'
        });
      }

      return res.status(200).json({
        success: true,
        data: detalle
      });
    } catch (error) {
      console.error('Error en obtenerDetalleAlumno:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno al obtener detalle del alumno'
      });
    }
  }

  async inhabilitarAlumno(req, res) {
    try {
      const { id } = req.params;
      const { fecha_inicio, fecha_fin, motivo } = req.body || {};

      const detalleActualizado = await alumnosService.inhabilitarAlumno(id, {
        fecha_inicio,
        fecha_fin,
        motivo
      });

      return res.status(200).json({
        success: true,
        message: 'Alumno inhabilitado temporalmente con éxito. Se conservaron sus datos personales y matrículas.',
        data: detalleActualizado
      });
    } catch (error) {
      console.error('Error en inhabilitarAlumno:', error);
      const status = error.statusCode || 500;
      return res.status(status).json({
        success: false,
        message: error.statusCode ? error.message : 'Error interno al inhabilitar temporalmente al alumno'
      });
    }
  }
}

module.exports = new AlumnosController();
