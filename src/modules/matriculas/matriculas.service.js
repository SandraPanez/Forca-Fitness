const matriculasRepository = require('./matriculas.repository');
const db = require('../../shared/config/database');

class MatriculasService {
  async getDisciplinasDisponibles() {
    return await matriculasRepository.getDisciplinas();
  }

  async getHorariosPorDisciplina(id_disciplina) {
    if (!id_disciplina) {
      throw new Error('El ID de la disciplina es obligatorio.');
    }
    const horarios = await matriculasRepository.getHorariosPorDisciplina(id_disciplina);
    
    // T_04: Cálculo de cupos disponibles en el servicio
    for (let horario of horarios) {
      const inscritos = await matriculasRepository.countInscritosPorHorario(horario.id_disc_horario);
      horario.cupos_disponibles = horario.capacidad_max - inscritos;
      
      if (horario.cupos_disponibles < 0) {
        horario.cupos_disponibles = 0;
      }
    }
    
    return horarios;
  }

  async registrarMatricula(datosMatricula) {
    const { disciplinas, observaciones_medicas, password, confirm_password, ...datosEstudiante } = datosMatricula;

    // Validación básica de campos requeridos (T_06)
    if (!datosEstudiante.tipo_documento || !datosEstudiante.numero_documento || !datosEstudiante.nombres) {
      throw new Error('Campos obligatorios faltantes en los datos del estudiante.');
    }
    
    if (!disciplinas || !Array.isArray(disciplinas) || disciplinas.length === 0) {
      throw new Error('Debe seleccionar al menos una disciplina.');
    }

    if (!password || password !== confirm_password) {
      throw new Error('La contraseña es inválida o no coinciden.');
    }

    const bcrypt = require('bcryptjs');
    datosEstudiante.password_hash = await bcrypt.hash(password, 10);

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

      const matriculaExistente = await matriculasRepository.getMatriculaPendientePorAlumno(
        estudianteId,
        client
      );
      const matriculaId = matriculaExistente || await matriculasRepository.createMatricula(
        estudianteId,
        observaciones_medicas,
        client
      );

      if (!matriculaExistente) {
        await matriculasRepository.addDisciplinasAMatricula(matriculaId, disciplinas, client);
      }

      await client.query('COMMIT');
      const resumen = await matriculasRepository.getResumenMatricula(matriculaId);
      return {
        success: true,
        matriculaId,
        monto: resumen.monto,
        disciplinas: resumen.disciplinas,
        mensaje: matriculaExistente
          ? 'Se recuperó tu matrícula pendiente'
          : 'Matrícula registrada exitosamente',
        reutilizada: Boolean(matriculaExistente)
      };

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
