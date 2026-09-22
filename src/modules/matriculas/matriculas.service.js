const matriculasRepository = require('./matriculas.repository');
const db = require('../../shared/config/database');

class MatriculasService {
  async getDisciplinasDisponibles() {
    return await matriculasRepository.getDisciplinas();
  }

  async registrarMatricula(datosMatricula) {
    const { disciplinas, observaciones_medicas, ...datosEstudiante } = datosMatricula;

    // Validación básica de campos requeridos (T_06)
    if (!datosEstudiante.tipo_documento || !datosEstudiante.numero_documento || !datosEstudiante.nombres) {
      throw new Error('Campos obligatorios faltantes en los datos del estudiante.');
    }
    
    if (!disciplinas || !Array.isArray(disciplinas) || disciplinas.length === 0) {
      throw new Error('Debe seleccionar al menos una disciplina.');
    }

    // Iniciar transacción de base de datos
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Manejar el Estudiante (Verificar si existe para crear o actualizar)
      let estudianteId;
      const estudianteExistente = await matriculasRepository.findEstudianteByDocumento(
        datosEstudiante.tipo_documento,
        datosEstudiante.numero_documento
      );

      if (estudianteExistente) {
        estudianteId = estudianteExistente.id;
        // Actualizamos los datos en caso haya cambios (dirección, celular, etc)
        await matriculasRepository.updateEstudiante(estudianteId, datosEstudiante, client);
      } else {
        // Creamos nuevo estudiante
        estudianteId = await matriculasRepository.createEstudiante(datosEstudiante, client);
      }

      // 2. Crear la Matrícula
      const matriculaId = await matriculasRepository.createMatricula(
        estudianteId,
        observaciones_medicas,
        client
      );

      // 3. Asociar las Disciplinas a la Matrícula
      await matriculasRepository.addDisciplinasAMatricula(matriculaId, disciplinas, client);

      await client.query('COMMIT');
      return { success: true, matriculaId, mensaje: 'Matrícula registrada exitosamente' };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error en transacción de matrícula:', error);
      throw new Error('Error al registrar la matrícula: ' + error.message);
    } finally {
      client.release();
    }
  }
}

module.exports = new MatriculasService();
