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
      const { periodo } = req.query;
      const resultado = await matriculasService.getHorariosPorDisciplina(id, periodo);
      return successResponse(res, 200, resultado, 'Horarios obtenidos correctamente');
    } catch (error) {
      console.error('Error en getHorariosPorDisciplina:', error);
      const isUserError = error.message.includes('obligatorio') || error.message.includes('periodo');
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
      let mensaje = error.message || 'Error al registrar la matrícula';
      if (mensaje.includes('UQ_Usuario_Correo') || (mensaje.includes('unique constraint') && mensaje.includes('Correo'))) {
        mensaje = 'El correo electrónico ya se encuentra registrado con otra cuenta.';
      } else if (mensaje.includes('unique constraint') && mensaje.includes('Documento')) {
        mensaje = 'El número de documento ya se encuentra registrado.';
      }
      return errorResponse(res, 400, mensaje);
    }
  }
}

module.exports = new MatriculasController();
