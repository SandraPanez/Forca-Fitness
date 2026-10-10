const matriculasService = require('./matriculas.service');
const { successResponse, errorResponse } = require('../../shared/utils/response.util');

class MatriculasController {
  async getDisciplinas(req, res) {
    try {
      const disciplinas = await matriculasService.getDisciplinasDisponibles();
      return successResponse(res, 200, disciplinas, 'Disciplinas obtenidas correctamente');
    } catch (error) {
      console.error('Error en getDisciplinas:', error);
      return errorResponse(res, 500, 'Error interno al obtener las disciplinas');
    }
  }

  async getHorariosPorDisciplina(req, res) {
    try {
      const { id } = req.params;
      const horarios = await matriculasService.getHorariosPorDisciplina(id);
      return successResponse(res, 200, horarios, 'Horarios obtenidos correctamente');
    } catch (error) {
      console.error('Error en getHorariosPorDisciplina:', error);
      const isUserError = error.message.includes('obligatorio');
      return errorResponse(res, isUserError ? 400 : 500, error.message || 'Error al obtener los horarios');
    }
  }

  async getMisMatriculas(req, res) {
    try {
      const idUsuario = req.user.id;

      const matriculas = await matriculasService.getMatriculasPorUsuario(
        idUsuario
      );

      return successResponse(
        res,
        200,
        matriculas,
        'Matrículas obtenidas correctamente'
      );
    } catch (error) {
      console.error('Error en getMisMatriculas:', error);

      const isUserError = error.message.includes('obligatorio');

      return errorResponse(
        res,
        isUserError ? 400 : 500,
        error.message || 'Error interno al obtener las matrículas'
      );
    }
  }

  async registrarMatricula(req, res) {
    try {
      const datosMatricula = req.body;
      const resultado = await matriculasService.registrarMatricula(datosMatricula);
      return successResponse(res, 201, resultado, 'Matrícula registrada exitosamente');
    } catch (error) {
      console.error('Error en registrarMatricula:', error);
      const isValidationError = error.message.includes('Campos obligatorios') || error.message.includes('Debe seleccionar al menos una disciplina');
      return errorResponse(res, isValidationError ? 400 : 500, isValidationError ? error.message : 'Error interno al registrar la matrícula');
    }
  }
}

module.exports = new MatriculasController();
