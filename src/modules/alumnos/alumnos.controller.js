const alumnosService = require('./alumnos.service');

class AlumnosController {
  async listarAlumnos(req, res) {
    try {
      const idProfesor = req.usuario?.id_profesor || req.query.id_profesor || null;
      const alumnos = await alumnosService.listarAlumnos(idProfesor);

      const esDirector = (req.user?.roles || []).some(
        rol => String(rol).toUpperCase() === 'DIRECTOR'
      );

      const alumnosVisibles = esDirector
        ? alumnos
        : alumnos.filter(alumno =>
            String(alumno.estado_alumno_registrado || '').trim().toUpperCase() !== 'INHABILITADO'
          );

      return res.status(200).json({
        success: true,
        data: alumnosVisibles
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

      const esDirector = (req.user?.roles || []).some(
        rol => String(rol).toUpperCase() === 'DIRECTOR'
      );

      const esInhabilitado =
        String(detalle.estado_alumno_registrado || '')
          .trim().toUpperCase() === 'INHABILITADO';

      if (esInhabilitado && !esDirector) {
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

  
  async obtenerHistorialMatriculas(req, res) {
    try {
      const { id } = req.params;
      const historial = await alumnosService.obtenerHistorialMatriculas(id);

      if (!historial) {
        return res.status(404).json({
          success: false,
          message: 'Alumno no encontrado'
        });
      }

      return res.status(200).json({
        success: true,
        data: historial
      });
    } catch (error) {
      console.error('Error en obtenerHistorialMatriculas:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno al obtener el historial de matrículas'
      });
    }
  }
}

module.exports = new AlumnosController();
