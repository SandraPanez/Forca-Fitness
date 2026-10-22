const matriculasRepository = require('./matriculas.repository');
const db = require('../../shared/config/database');

class MatriculasService {
  async getDisciplinasDisponibles() {
    return await matriculasRepository.getDisciplinas();
  }

  async getHorariosPorDisciplina(id_disciplina, periodo) {
    if (!id_disciplina) {
      throw new Error('El ID de la disciplina es obligatorio.');
    }

    const hoy = new Date();
    const anioActual = hoy.getFullYear();
    const mesActual = hoy.getMonth() + 1;

    let anio = anioActual;
    let mes = mesActual;
    let diffMeses = 0;

    if (periodo) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) {
        throw new Error('El formato del periodo debe ser YYYY-MM.');
      }
      const parts = periodo.split('-');
      anio = parseInt(parts[0], 10);
      mes = parseInt(parts[1], 10);
      diffMeses = (anio - anioActual) * 12 + (mes - mesActual);

      if (diffMeses < 0) {
        throw new Error('No se puede consultar disponibilidad para un periodo pasado.');
      }
      if (diffMeses > 2) {
        throw new Error('Solo se permite consultar disponibilidad con hasta un máximo de 2 meses de anticipación.');
      }
    } else {
      periodo = `${anioActual}-${String(mesActual).padStart(2, '0')}`;
    }

    const es_periodo_futuro = diffMeses > 0;
    const fechaInicioStr = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const ultimoDia = new Date(anio, mes, 0).getDate();
    const fechaFinStr = `${anio}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

    const disciplina = await matriculasRepository.getDisciplinaById(id_disciplina);
    const horarios = await matriculasRepository.getHorariosPorDisciplina(id_disciplina);

    const MAX_CUPOS_RESERVA = 4;
    const reservasDisciplina = await matriculasRepository.countReservasPorDisciplinaYPeriodo(
      id_disciplina,
      fechaInicioStr,
      fechaFinStr
    );
    const cuposReservaRestantesDisciplina = Math.max(0, MAX_CUPOS_RESERVA - reservasDisciplina);

    for (let horario of horarios) {
      const inscritos = await matriculasRepository.countInscritosPorHorarioYPeriodo(
        horario.id_disc_horario,
        fechaInicioStr,
        fechaFinStr
      );

      horario.capacidad_max = Number(horario.capacidad_max);
      horario.cupos_disponibles = Math.max(0, horario.capacidad_max - inscritos);
      horario.max_cupos_reserva = MAX_CUPOS_RESERVA;
      horario.cupos_reservados_disciplina = reservasDisciplina;
      horario.cupos_reserva_disponibles = Math.min(
        cuposReservaRestantesDisciplina,
        horario.cupos_disponibles
      );
      horario.tarifa = disciplina ? Number(disciplina.tarifa) : 0;
      horario.periodo = periodo;
      horario.es_periodo_futuro = es_periodo_futuro;

      if (es_periodo_futuro) {
        if (horario.cupos_reserva_disponibles <= 0) {
          horario.puede_reservar = false;
          horario.mensaje_reserva = 'No hay cupos disponibles para reserva';
        } else {
          horario.puede_reservar = true;
          horario.mensaje_reserva = `${horario.cupos_reserva_disponibles} cupo${horario.cupos_reserva_disponibles > 1 ? 's' : ''} disponible${horario.cupos_reserva_disponibles > 1 ? 's' : ''} para reserva`;
        }
      } else {
        horario.puede_reservar = horario.cupos_disponibles > 0;
        horario.mensaje_reserva = horario.cupos_disponibles > 0
          ? `${horario.cupos_disponibles} cupo${horario.cupos_disponibles > 1 ? 's' : ''} disponible${horario.cupos_disponibles > 1 ? 's' : ''}`
          : 'Sin cupos disponibles para este horario';
      }
    }

    const mesesNombres = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    return {
      disciplina: disciplina || null,
      periodo,
      anio,
      mes,
      mes_nombre: mesesNombres[mes - 1],
      es_periodo_futuro,
      max_cupos_reserva: MAX_CUPOS_RESERVA,
      cupos_reserva_disciplina_restantes: cuposReservaRestantesDisciplina,
      total_reservas_disciplina: reservasDisciplina,
      horarios
    };
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
      // Algunas matrículas antiguas todavía no tienen detalle asociado.
      if (!matricula.fecha_fin) {
        return {
          ...matricula,
          estado_vigencia: null,
          dias_restantes: null,
          vigente: false
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

      const fechaInicio = matricula.fecha_inicio ? new Date(matricula.fecha_inicio) : null;
      if (fechaInicio) fechaInicio.setHours(0, 0, 0, 0);

      if (matricula.estado_matricula === 'Reservada') {
        if (fechaInicio && fechaInicio <= hoy) {
          estadoVigencia = 'Activa';
        } else {
          estadoVigencia = 'Reservada';
        }
      } else if (fechaInicio && fechaInicio > hoy) {
        estadoVigencia = 'Reservada';
      } else if (diasRestantes < 0) {
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
        vigente: diasRestantes >= 0
      };
    });
  }

  async registrarMatricula(datosMatricula) {
    const { disciplinas, observaciones_medicas, password, confirm_password, ...datosEstudiante } = datosMatricula;

    // Validación básica de campos requeridos (T_06)
    if (!datosEstudiante.tipo_documento || !datosEstudiante.numero_documento || !datosEstudiante.nombres) {
      throw new Error('Campos obligatorios faltantes en los datos del estudiante.');
    }

    const numDoc = String(datosEstudiante.numero_documento).trim();
    if (datosEstudiante.tipo_documento === 'DNI') {
      if (!/^\d{8}$/.test(numDoc)) {
        throw new Error('El DNI debe contener exactamente 8 dígitos numéricos.');
      }
    } else if (datosEstudiante.tipo_documento === 'CE') {
      if (!/^\d{9}$/.test(numDoc) && !/^[a-zA-Z0-9]{9}$/.test(numDoc)) {
        throw new Error('El Carnet de Extranjería debe contener exactamente 9 caracteres.');
      }
    } else if (datosEstudiante.tipo_documento === 'Pasaporte') {
      if (!/^[a-zA-Z0-9]{6,10}$/.test(numDoc)) {
        throw new Error('El Pasaporte debe contener entre 6 y 10 caracteres alfanuméricos.');
      }
    }
    
    if (!disciplinas || !Array.isArray(disciplinas) || disciplinas.length === 0) {
      throw new Error('Debe seleccionar al menos una disciplina.');
    }

    if (!password || password.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres.');
    }

    if (password !== confirm_password) {
      throw new Error('Las contraseñas no coinciden.');
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
