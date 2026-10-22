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

  async getMatriculasPorUsuario(idUsuario) {
    if (!idUsuario) {
      throw new Error('El ID del usuario es obligatorio.');
    }

    const matriculas = await matriculasRepository.getMatriculasPorUsuario(
      idUsuario
    );

    const MILISEGUNDOS_POR_DIA = 1000 * 60 * 60 * 24;

    return matriculas.map(matricula => {
      const aprobada = ['ACTIVA', 'ACTIVO', 'VENCIDA'].includes(String(matricula.estado_matricula).toUpperCase());
      if (!aprobada) {
        return { ...matricula, estado_vigencia: String(matricula.estado_matricula).toUpperCase().startsWith('PENDIENTE')
          ? 'Pendiente de pago' : matricula.estado_matricula, dias_restantes: null, vigente: false, puede_renovar: false };
      }
      // Algunas matrículas antiguas todavía no tienen detalle asociado.
      if (!matricula.fecha_fin) {
        return {
          ...matricula,
          estado_vigencia: null,
          dias_restantes: null,
          vigente: false,
          puede_renovar: false
        };
      }

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      const fechaFin = new Date(matricula.fecha_fin);
      fechaFin.setHours(0, 0, 0, 0);

      const diasRestantes = Math.round(
        (fechaFin - hoy) / MILISEGUNDOS_POR_DIA
      );

      let estadoVigencia;

      if (diasRestantes < 0) {
        estadoVigencia = 'Vencida';
      } else if (diasRestantes <= 3) {
        estadoVigencia = 'Próxima a vencer';
      } else {
        estadoVigencia = 'Activa';
      }

      return {
        ...matricula,
        estado_vigencia: estadoVigencia,
        dias_restantes: diasRestantes,
        vigente: diasRestantes >= 0,
        puede_renovar: diasRestantes <= 3 &&
          new Date(matricula.fecha_fin).getTime() === new Date(matricula.fecha_fin_actual).getTime()
      };
    });
  }

  async renovarMatricula(idUsuario, idDetalle) {
    if (typeof idDetalle !== 'string' || !idDetalle || idDetalle.length > 10) {
      throw Object.assign(new Error('La matrícula seleccionada no es válida.'), { status: 400 });
    }
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const info = await matriculasRepository.getDetalleParaRenovar(idUsuario, idDetalle, client);
      if (!info) throw Object.assign(new Error('No se encontró una matrícula tuya habilitada para renovar.'), { status: 404 });
      if (!info.puede_renovar) throw Object.assign(new Error('Puedes renovar cuando falten tres días o la matrícula haya vencido.'), { status: 409 });
      const horario = await client.query(`
        SELECT "Capacidad_Max" AS capacidad FROM "Academia Forca&Fitness"."Disciplina_Horario"
        WHERE "Id_DiscHorario" = $1 FOR UPDATE
      `, [info.id_disc_horario]);
      const inscritos = await matriculasRepository.countInscritosPorHorario(info.id_disc_horario, client, info.id_alumno);
      if (!horario.rows[0] || inscritos >= Number(horario.rows[0].capacidad)) {
        throw Object.assign(new Error('No hay cupos disponibles en tu horario actual.'), { status: 409 });
      }
      const pendiente = await matriculasRepository.getMatriculaPendientePorAlumno(info.id_alumno, client);
      if (pendiente) {
        const detalles = await client.query(`
          SELECT COUNT(*)::INT AS total,
            COUNT(*) FILTER (WHERE "Id_DiscHorario" = $2)::INT AS coinciden
          FROM "Academia Forca&Fitness"."Detalles_Matricula" WHERE "Id_Matricula" = $1
        `, [pendiente, info.id_disc_horario]);
        if (detalles.rows[0].total !== 1 || detalles.rows[0].coinciden !== 1) {
          throw Object.assign(new Error('Ya tienes otra matrícula pendiente. Completa ese pago antes de renovar.'), { status: 409 });
        }
      }
      const matriculaId = pendiente || await matriculasRepository.createMatricula(info.id_alumno, null, client);
      if (!pendiente) await matriculasRepository.addDetalleRenovacion(matriculaId, info, client);
      const resumen = await matriculasRepository.getResumenMatricula(matriculaId, client);
      if (!Number.isFinite(Number(resumen.monto)) || Number(resumen.monto) <= 0) {
        throw Object.assign(new Error('La disciplina no tiene una tarifa configurada.'), { status: 409 });
      }
      await client.query('COMMIT');
      return { matriculaId, ...resumen, nombre: info.nombre, correo: info.correo,
        fecha_inicio: info.fecha_inicio, fecha_fin: info.fecha_fin, reutilizada: Boolean(pendiente) };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
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
