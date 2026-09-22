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
}

module.exports = new MatriculasController();
