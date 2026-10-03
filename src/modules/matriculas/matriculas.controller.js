const matriculasService = require('./matriculas.service');

class MatriculasController {
  async getDisciplinas(req, res) {
    try {
      const disciplinas = await matriculasService.getDisciplinasDisponibles();
      return res.status(200).json({
        success: true,
        data: disciplinas
      });
    } catch (error) {
      console.error('Error en getDisciplinas:', error);
      return res.status(500).json({
        success: false,
        message: 'Error al obtener las disciplinas'
      });
    }
  }

  async registrarMatricula(req, res) {
    try {
      const datosMatricula = req.body;
      const resultado = await matriculasService.registrarMatricula(datosMatricula);
      
      return res.status(201).json(resultado);
    } catch (error) {
      console.error('Error en registrarMatricula:', error);
      
      // Si es un error de validación que lanzamos desde el servicio
      if (error.message.includes('Campos obligatorios') || error.message.includes('Debe seleccionar al menos una disciplina')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Error interno al registrar la matrícula'
      });
    }
  }
}

module.exports = new MatriculasController();
