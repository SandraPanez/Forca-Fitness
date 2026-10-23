const matriculasRepository = require('./matriculas.repository');
const db = require('../../shared/config/database');

class MatriculasService {
  async getDisciplinasDisponibles() {
    return await matriculasRepository.getDisciplinas();
  }

  validarReglasReserva({ periodo }) {
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
        throw new Error('No se puede seleccionar ni consultar un periodo pasado.');
      }
      if (diffMeses > 2) {
        throw new Error('Solo se permite seleccionar o reservar cupo con hasta un máximo de 2 meses de anticipación.');
      }
    } else {
      periodo = `${anioActual}-${String(mesActual).padStart(2, '0')}`;
    }

    const es_periodo_futuro = diffMeses > 0;
    const ultimoDia = new Date(anio, mes, 0).getDate();
    const fechaInicioStr = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const fechaFinStr = `${anio}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

    return {
      valido: true,
      periodo,
      anio,
      mes,
      diffMeses,
      es_periodo_futuro,
      fechaInicioStr,
      fechaFinStr
    };
  }

  async validarTopeCuposReserva(id_disciplina, periodo) {
    if (!id_disciplina) {
      throw new Error('El ID de la disciplina es obligatorio.');
    }
    const reg = this.validarReglasReserva({ periodo });
    const MAX_CUPOS_RESERVA = 4;

    if (!reg.es_periodo_futuro) {
      return {
        valido: true,
        puede_reservar: true,
        es_periodo_futuro: false,
        periodo: reg.periodo,
        max_cupos_reserva: MAX_CUPOS_RESERVA,
        cupos_reservados: 0,
        cupos_reserva_disponibles: null,
        mensaje: 'Periodo corriente'
      };
    }

    const reservasDisciplina = await matriculasRepository.countReservasPorDisciplinaYPeriodo(
      id_disciplina,
      reg.fechaInicioStr,
      reg.fechaFinStr
    );
    const cuposReservaRestantes = Math.max(0, MAX_CUPOS_RESERVA - reservasDisciplina);
    const puedeReservar = cuposReservaRestantes > 0;

    return {
      valido: puedeReservar,
      puede_reservar: puedeReservar,
      es_periodo_futuro: true,
      periodo: reg.periodo,
      max_cupos_reserva: MAX_CUPOS_RESERVA,
      cupos_reservados: reservasDisciplina,
      cupos_reserva_disponibles: cuposReservaRestantes,
      mensaje: puedeReservar
        ? `${cuposReservaRestantes} cupo${cuposReservaRestantes > 1 ? 's' : ''} disponible${cuposReservaRestantes > 1 ? 's' : ''} para reserva`
        : 'No hay cupos disponibles para reserva'
    };
  }

  async getHorariosPorDisciplina(id_disciplina, periodo) {
    if (!id_disciplina) {
      throw new Error('El ID de la disciplina es obligatorio.');
    }

    const reg = this.validarReglasReserva({ periodo });
    const { anio, mes, es_periodo_futuro, fechaInicioStr, fechaFinStr } = reg;
    periodo = reg.periodo;

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
    const { disciplinas, observaciones_medicas, password, confirm_password, periodo, ...datosEstudiante } = datosMatricula;

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

    // Validación de periodo de reserva y tope máximo de 4 cupos
    let fechasDetalle = null;
    if (periodo) {
      const reg = this.validarReglasReserva({ periodo });
      if (reg.es_periodo_futuro) {
        fechasDetalle = {
          fecha_inicio: reg.fechaInicioStr,
          fecha_fin: reg.fechaFinStr
        };

        for (const discId of disciplinas) {
          const cuposInfo = await this.validarTopeCuposReserva(discId, periodo);
          if (!cuposInfo.puede_reservar) {
            throw new Error(`No hay cupos disponibles para reserva en la disciplina seleccionada. Se agotaron los 4 cupos de reserva para el periodo ${periodo}.`);
          }
        }
      }
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
        await matriculasRepository.addDisciplinasAMatricula(matriculaId, disciplinas, client, fechasDetalle);
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

  async crearReservaCupo({ id_usuario, id_disciplina, id_disc_horario, periodo }) {
    if (!id_usuario) {
      throw new Error('Debe iniciar sesión para reservar un cupo.');
    }
    if (!id_disciplina) {
      throw new Error('Debe seleccionar una disciplina.');
    }

    const reg = this.validarReglasReserva({ periodo });
    if (!reg.es_periodo_futuro) {
      throw new Error('La reserva anticipada solo aplica para periodos futuros.');
    }

    // Validar tope máximo de 4 cupos para la disciplina
    const cuposInfo = await this.validarTopeCuposReserva(id_disciplina, reg.periodo);
    if (!cuposInfo.puede_reservar) {
      throw new Error(`No hay cupos disponibles para reserva en esta disciplina. Se agotaron los 4 cupos para el periodo ${reg.periodo}.`);
    }

    const alumno = await matriculasRepository.getAlumnoPorUsuario(id_usuario);
    if (!alumno) {
      throw new Error('No se encontró un perfil de alumno asociado a este usuario.');
    }

    const disciplina = await matriculasRepository.getDisciplinaById(id_disciplina);
    if (!disciplina) {
      throw new Error('La disciplina seleccionada no existe.');
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const idMatricula = await matriculasRepository.createMatricula(
        alumno.id_alumno,
        `Reserva anticipada periodo ${reg.periodo}`,
        client
      );

      let horarioFinal = id_disc_horario;
      if (!horarioFinal) {
        const hRes = await client.query(
          `SELECT "Id_DiscHorario" FROM "Academia Forca&Fitness"."Disciplina_Horario" WHERE "Id_Disciplina" = $1 LIMIT 1`,
          [id_disciplina]
        );
        horarioFinal = hRes.rows[0]?.Id_DiscHorario;
      }

      if (!horarioFinal) {
        throw new Error('No hay horarios disponibles configurados para esta disciplina.');
      }

      const idDetalle = await matriculasRepository.generateId(
        client,
        'Detalles_Matricula',
        'Id_DetMatricula',
        'DET'
      );

      await client.query(
        `
          INSERT INTO "Academia Forca&Fitness"."Detalles_Matricula" (
            "Id_DetMatricula",
            "Id_Matricula",
            "Fecha_Inicio",
            "Fecha_Fin",
            "Id_DiscHorario"
          )
          VALUES ($1, $2, $3::date, $4::date, $5)
        `,
        [
          idDetalle,
          idMatricula,
          reg.fechaInicioStr,
          reg.fechaFinStr,
          horarioFinal
        ]
      );

      await client.query('COMMIT');

      const monto = Number(disciplina.tarifa || 0);
      const concepto = `Reserva - ${disciplina.nombre} (${reg.mes_nombre} ${reg.anio})`;

      return {
        matriculaId: idMatricula,
        nombre: alumno.nombre_completo,
        correo: alumno.correo,
        disciplina: disciplina.nombre,
        monto,
        periodo: reg.periodo,
        concepto
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error al crear reserva de cupo:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = new MatriculasService();
