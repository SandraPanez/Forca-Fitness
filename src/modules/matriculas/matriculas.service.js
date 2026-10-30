const matriculasRepository = require('./matriculas.repository');
const db = require('../../shared/config/database');
const { calcularEdadMatricula, disciplinaPermitidaPorEdad } = require('../../../public/js/disciplinas-edad');

function validarEdadParaDisciplina(fechaNacimiento, nombre) {
  const edad = calcularEdadMatricula(fechaNacimiento);
  if (edad === null) {
    throw Object.assign(new Error('Ingresa una fecha de nacimiento válida, sin fechas futuras.'), { status: 400 });
  }
  if (!disciplinaPermitidaPorEdad(edad, nombre)) {
    throw Object.assign(new Error(edad <= 12
      ? 'Los alumnos de hasta 12 años solo pueden matricularse en disciplinas Kids.'
      : `${nombre} solo admite alumnos de hasta 12 años inclusive.`), { status: 400 });
  }
}

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
      mes_nombre: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][mes - 1] || '',
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

    await matriculasRepository.activarReservasIniciadas();

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

  async getHorariosTodasLasDisciplinas(periodo) {
    await matriculasRepository.activarReservasIniciadas();

    const reg = this.validarReglasReserva({ periodo });
    const { anio, mes, es_periodo_futuro, fechaInicioStr, fechaFinStr } = reg;
    periodo = reg.periodo;

    const MAX_CUPOS_RESERVA = 4;
    const disciplinas = await matriculasRepository.getDisciplinas();

    const mesesNombres = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const listaDisciplinas = [];

    for (const disc of disciplinas) {
      const horarios = await matriculasRepository.getHorariosPorDisciplina(disc.id);
      const reservasDisciplina = await matriculasRepository.countReservasPorDisciplinaYPeriodo(
        disc.id,
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
        horario.tarifa = Number(disc.tarifa);
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

      listaDisciplinas.push({
        disciplina: disc,
        cupos_reserva_disciplina_restantes: cuposReservaRestantesDisciplina,
        total_reservas_disciplina: reservasDisciplina,
        horarios
      });
    }

    return {
      periodo,
      anio,
      mes,
      mes_nombre: mesesNombres[mes - 1],
      es_periodo_futuro,
      max_cupos_reserva: MAX_CUPOS_RESERVA,
      todas: true,
      disciplinas: listaDisciplinas
    };
  }

  async getMatriculasPorUsuario(idUsuario) {
    if (!idUsuario) {
      throw new Error('El ID del usuario es obligatorio.');
    }

    await matriculasRepository.activarReservasIniciadas();

    const matriculas = await matriculasRepository.getMatriculasPorUsuario(
      idUsuario
    );

    const MILISEGUNDOS_POR_DIA = 1000 * 60 * 60 * 24;

    return matriculas.map(matricula => {
      const aprobada = ['ACTIVA', 'ACTIVO', 'VENCIDA', 'RESERVADA'].includes(String(matricula.estado_matricula).toUpperCase());
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
      validarEdadParaDisciplina(info.fecha_nacimiento, info.disciplina);
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

    const disponibles = await matriculasRepository.getDisciplinas();
    for (const id of disciplinas) {
      const disciplina = disponibles.find(item => item.id === id);
      if (!disciplina) throw new Error('La disciplina seleccionada no existe.');
      validarEdadParaDisciplina(datosEstudiante.fecha_nacimiento, disciplina.nombre);
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

    // 1. Verificar si el Estudiante ya existe (por documento o correo para no exigir contraseña si la cuenta ya está creada)
    let estudianteExistente = await matriculasRepository.findEstudianteByDocumento(
      datosEstudiante.tipo_documento,
      datosEstudiante.numero_documento
    );

    if (!estudianteExistente && datosEstudiante.correo_electronico) {
      estudianteExistente = await matriculasRepository.findEstudianteByCorreo(
        datosEstudiante.correo_electronico
      );
    }

    if (!estudianteExistente) {
      if (!password || password.length < 6) {
        throw new Error('La contraseña debe tener al menos 6 caracteres.');
      }

      if (password !== confirm_password) {
        throw new Error('Las contraseñas no coinciden.');
      }
    }

    if (password) {
      if (password.length < 6) {
        throw new Error('La contraseña debe tener al menos 6 caracteres.');
      }
      if (confirm_password && password !== confirm_password) {
        throw new Error('Las contraseñas no coinciden.');
      }
      const bcrypt = require('bcryptjs');
      datosEstudiante.password_hash = await bcrypt.hash(password, 10);
    }

    // Iniciar transacción de base de datos
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Manejar el Estudiante (Verificar si existe para crear o actualizar)
      let estudianteId;
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
      } else {
        // Se valida lo que realmente se va a pagar, también al recuperar un pendiente antiguo.
        const guardadas = await client.query(`
          SELECT d."Nombre_Disciplina" AS nombre
          FROM "Academia Forca&Fitness"."Detalles_Matricula" dm
          JOIN "Academia Forca&Fitness"."Disciplina_Horario" dh ON dh."Id_DiscHorario" = dm."Id_DiscHorario"
          JOIN "Academia Forca&Fitness"."Disciplina" d ON d."Id_Disciplinas" = dh."Id_Disciplina"
          WHERE dm."Id_Matricula" = $1
        `, [matriculaId]);
        for (const disciplina of guardadas.rows) {
          validarEdadParaDisciplina(datosEstudiante.fecha_nacimiento, disciplina.nombre);
        }
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
    validarEdadParaDisciplina(alumno.fecha_nacimiento, disciplina.nombre);

    // Validar si el alumno ya tiene esta disciplina pagada o pendiente en este periodo
    const yaRegistrado = await matriculasRepository.verificarDisciplinaActivaOPendiente(
      alumno.id_alumno,
      id_disciplina,
      reg.fechaInicioStr,
      reg.fechaFinStr
    );
    if (yaRegistrado) {
      const pagado = yaRegistrado.estado_pago === 'APROBADO' || ['Activa', 'Reservada'].includes(yaRegistrado.estado_matricula);
      if (pagado) {
        throw new Error(`Ya tienes una vacante confirmada y pagada para ${disciplina.nombre} en el periodo ${reg.periodo}.`);
      }
      if (yaRegistrado.medio_pago === 'EFECTIVO' || String(yaRegistrado.estado_matricula).toUpperCase().includes('CONFIRMACIÓN')) {
        throw new Error(`Ya tienes una solicitud de reserva en efectivo pendiente de confirmación para ${disciplina.nombre} en el periodo ${reg.periodo}. Espera la validación de recepción.`);
      }
      // Si ya tiene una reserva en proceso o pendiente de pago, se reutiliza y se envía directamente al cobro
      if (id_disc_horario) {
        await db.query(
          `UPDATE "Academia Forca&Fitness"."Detalles_Matricula"
           SET "Id_DiscHorario" = $1
           WHERE "Id_Matricula" = $2`,
          [id_disc_horario, yaRegistrado.id_matricula]
        );
      }

      const monto = Number(disciplina.tarifa || 0);
      const concepto = `Reserva - ${disciplina.nombre} (${reg.mes_nombre} ${reg.anio})`;

      return {
        matriculaId: yaRegistrado.id_matricula,
        nombre: alumno.nombre_completo,
        correo: alumno.correo,
        disciplina: disciplina.nombre,
        monto,
        periodo: reg.periodo,
        concepto,
        reutilizada: true
      };
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const idMatricula = await matriculasRepository.createMatricula(
        alumno.id_alumno,
        `Reserva anticipada periodo ${reg.periodo}`,
        client
      );

      const hRes = await client.query(`
        SELECT "Id_DiscHorario" FROM "Academia Forca&Fitness"."Disciplina_Horario"
        WHERE "Id_Disciplina" = $1 AND ($2::text IS NULL OR "Id_DiscHorario" = $2)
        ORDER BY "Id_DiscHorario" LIMIT 1
      `, [id_disciplina, id_disc_horario || null]);
      const horarioFinal = hRes.rows[0]?.Id_DiscHorario;

      if (!horarioFinal) {
        throw new Error('No hay un horario válido para la disciplina seleccionada.');
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
