const alumnosRepository = require('./alumnos.repository');

const INHABILITACION_REGEX = /\[INHABILITADO\|([^|]*)\|([^|]*)\|([^\]]*)\]/;

function extraerMetadataInhabilitacion(condicionRaw) {
  const texto = String(condicionRaw || '');
  const match = texto.match(INHABILITACION_REGEX);
  const observacionesLimpias = texto.replace(INHABILITACION_REGEX, '').trim() || 'Ninguna';

  if (!match) {
    return {
      observaciones_medicas: observacionesLimpias,
      inhabilitacion: null
    };
  }

  return {
    observaciones_medicas: observacionesLimpias,
    inhabilitacion: {
      fecha_inicio: match[1] || null,
      fecha_fin: match[2] || null,
      motivo: match[3] || 'Inhabilitación temporal'
    }
  };
}

function esEstadoInhabilitado(estadoAlumnoDb) {
  const estadoNorm = String(estadoAlumnoDb || '').trim().toUpperCase();
  return estadoNorm === 'INHABILITADO' || estadoNorm === 'INACTIVO';
}

class AlumnosService {
  async listarAlumnos(idProfesor = null) {
    const records = await alumnosRepository.findAllAlumnos(idProfesor);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    return records.map(al => {
      let fechaVencimiento = null;
      if (al.fecha_fin) {
        fechaVencimiento = new Date(al.fecha_fin);
      } else if (al.fecha_matricula) {
        fechaVencimiento = new Date(al.fecha_matricula);
        fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);
      }
      if (fechaVencimiento) fechaVencimiento.setHours(0, 0, 0, 0);
      
      const diffTime = fechaVencimiento ? (fechaVencimiento.getTime() - hoy.getTime()) : 0;
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      
      const inhabilitado = esEstadoInhabilitado(al.estado_alumno);
      const { inhabilitacion } = extraerMetadataInhabilitacion(al.observaciones_medicas);

      const esReservada = al.estado === 'Reservada';
      let estado_matricula_real;
      if (esReservada) {
        estado_matricula_real = 'Reservada';
      } else if (diffDays < 0) {
        estado_matricula_real = 'Vencida';
      } else if (diffDays <= 3) {
        estado_matricula_real = 'Próxima a vencer';
      } else {
        estado_matricula_real = 'Activa';
      }

      const estado_matricula = inhabilitado ? 'Inhabilitada' : estado_matricula_real;
      const nombres = al.nombres || '';
      const apellidoPaterno = al.apellido_paterno || '';
      
      return {
        id: al.id,
        nombres: al.nombres,
        apellido_paterno: al.apellido_paterno,
        apellido_materno: al.apellido_materno,
        estado_matricula: estado_matricula,
        estado_matricula_real: estado_matricula_real,
        estado_alumno: inhabilitado ? 'Inhabilitado' : 'Habilitado',
        inhabilitado: inhabilitado,
        periodo_inhabilitacion: inhabilitacion,
        dias_restantes: diffDays,
        por_vencer: !inhabilitado && estado_matricula_real === 'Próxima a vencer',
        fecha_vencimiento: fechaVencimiento ? fechaVencimiento.toISOString().slice(0, 10) : null,
        disciplinas: al.disciplinas || [],
        iniciales: `${nombres.charAt(0)}${apellidoPaterno.charAt(0)}`.toUpperCase()
      };
    });
  }

  async obtenerDetalleAlumno(id, idProfesor = null) {
    const record = await alumnosRepository.findAlumnoById(id, idProfesor);
    if (!record) return null;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    let fechaVencimiento = null;
    if (record.fecha_vencimiento) {
      fechaVencimiento = new Date(record.fecha_vencimiento);
    } else if (record.fecha_matricula) {
      fechaVencimiento = new Date(record.fecha_matricula);
      fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);
    }
    if (fechaVencimiento) fechaVencimiento.setHours(0, 0, 0, 0);
    
    const diffTime = fechaVencimiento ? (fechaVencimiento.getTime() - hoy.getTime()) : 0;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    const inhabilitado = esEstadoInhabilitado(record.estado_alumno_db);
    const { observaciones_medicas, inhabilitacion } = extraerMetadataInhabilitacion(record.observaciones_medicas);

    const esReservada = record.estado_matricula === 'Reservada';
    let estado_matricula_real;
    let dias_restantes_texto;

    if (esReservada) {
      estado_matricula_real = 'Reservada';
      dias_restantes_texto = 'Reservada - Inicia próximo periodo';
    } else if (diffDays < 0) {
      estado_matricula_real = 'Vencida';
      dias_restantes_texto = `Vencida hace ${Math.abs(diffDays)} día${Math.abs(diffDays) === 1 ? '' : 's'}`;
    } else if (diffDays <= 3) {
      estado_matricula_real = 'Próxima a vencer';
      dias_restantes_texto = diffDays === 0 ? 'Vence hoy' : `Próxima a vencer (${diffDays} día${diffDays === 1 ? '' : 's'} restante${diffDays === 1 ? '' : 's'})`;
    } else {
      estado_matricula_real = 'Activa';
      dias_restantes_texto = `Activa - ${diffDays} días restantes`;
    }

    const estado = inhabilitado ? 'Inhabilitada' : estado_matricula_real;
    const estado_alumno = inhabilitado ? 'Inhabilitado' : ((esReservada || diffDays >= 0) ? 'Habilitado' : 'Inhabilitado');

    const formatoFecha = fecha => {
      if (!fecha) return 'No registrada';
      const fechaFormateada = new Date(fecha);
      return Number.isNaN(fechaFormateada.getTime())
        ? 'No registrada'
        : fechaFormateada.toLocaleDateString('es-PE');
    };

    const formatearFechaIso = (fechaStr) => {
      if (!fechaStr) return 'No especificado';
      const partes = String(fechaStr).split('-');
      if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
      }
      return formatoFecha(fechaStr);
    };

    return {
      id: record.id,
      nombre_completo: [record.nombres, record.apellido_paterno, record.apellido_materno]
        .filter(Boolean)
        .join(' '),
      estado: estado,
      estado_matricula_real: estado_matricula_real,
      dni: record.numero_documento,
      correo: record.correo_electronico,
      celular: record.numero_celular || 'No registrado',
      fecha_nacimiento: formatoFecha(record.fecha_nacimiento),
      direccion: record.direccion || 'No registrada',
      disciplinas: record.disciplinas || 'Ninguna',
      fecha_inscripcion: formatoFecha(record.fecha_matricula),
      fecha_inicio: formatoFecha(record.fecha_inicio),
      fecha_vencimiento: formatoFecha(fechaVencimiento),
      dias_restantes_texto: dias_restantes_texto,
      estado_alumno: estado_alumno,
      inhabilitado: inhabilitado,
      inhabilitacion: inhabilitacion ? {
        fecha_inicio: inhabilitacion.fecha_inicio,
        fecha_fin: inhabilitacion.fecha_fin,
        fecha_inicio_formato: formatearFechaIso(inhabilitacion.fecha_inicio),
        fecha_fin_formato: formatearFechaIso(inhabilitacion.fecha_fin),
        motivo: inhabilitacion.motivo
      } : null,
      observaciones_medicas: observaciones_medicas
    };
  }

  async obtenerHistorialMatriculas(id) {
    const alumno = await alumnosRepository.findNombreAlumnoById(id);
    if (!alumno) return null;

    const registros = await alumnosRepository.findHistorialMatriculasByAlumno(id);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const aFecha = (texto) => new Date(`${texto}T00:00:00`);

    const matriculas = registros.map(reg => {
      const inicio = aFecha(reg.fecha_inicio);
      const fin = aFecha(reg.fecha_fin);

      let estado;
      if (inicio > hoy) estado = 'Reservada';
      else if (fin < hoy) estado = 'Vencida';
      else estado = 'Activa';

      return {
        id_detalle: reg.id_detalle,
        id_matricula: reg.id_matricula,
        tipo: reg.es_reserva_anticipada ? 'Reserva anticipada' : 'Regular',
        disciplina: reg.disciplina,
        horario: `${reg.dias} ${reg.hora_inicio} - ${reg.hora_fin}`,
        fecha_inicio: reg.fecha_inicio,
        fecha_fin: reg.fecha_fin,
        estado
      };
    });

    return {
      alumno: { id: alumno.id, nombre_completo: alumno.nombre_completo },
      permanencia: this.calcularPermanencia(registros, hoy),
      matriculas
    };
  }

  // Resumen rápido: "Desde 2025 - 14 meses en la academia"
  calcularPermanencia(registros, hoy = new Date()) {
    if (!registros.length) return null;

    const inicios = registros.map(r => new Date(`${r.fecha_inicio}T00:00:00`));
    const fines = registros.map(r => new Date(`${r.fecha_fin}T00:00:00`));
    const primerInicio = new Date(Math.min(...inicios));
    const ultimoFin = new Date(Math.max(...fines));
    const referencia = ultimoFin < hoy ? ultimoFin : hoy;

    const dias = Math.max(0, Math.round((referencia - primerInicio) / (1000 * 60 * 60 * 24)));
    const meses = dias === 0 ? 0 : Math.max(1, Math.round(dias / 30.44));
    const desde = primerInicio.getFullYear();

    return {
      desde,
      meses,
      texto: `Desde ${desde} - ${meses} ${meses === 1 ? 'mes' : 'meses'} en la academia`
    };
  }

  async inhabilitarAlumno(id, payload = {}) {
    const record = await alumnosRepository.findAlumnoById(id);
    if (!record) {
      const error = new Error('Alumno no encontrado.');
      error.statusCode = 404;
      throw error;
    }

    if (esEstadoInhabilitado(record.estado_alumno_db)) {
      const error = new Error('El alumno ya se encuentra inhabilitado.');
      error.statusCode = 409;
      throw error;
    }

    const fechaInicio = String(payload.fecha_inicio || '').trim();
    const fechaFin = String(payload.fecha_fin || '').trim();
    const motivoRaw = String(payload.motivo || '').trim();

    if (!fechaInicio || !fechaFin) {
      const error = new Error('Debe registrar la fecha de inicio y la fecha de fin del periodo de inhabilitación.');
      error.statusCode = 400;
      throw error;
    }

    const inicioDate = new Date(`${fechaInicio}T00:00:00`);
    const finDate = new Date(`${fechaFin}T00:00:00`);

    if (Number.isNaN(inicioDate.getTime()) || Number.isNaN(finDate.getTime())) {
      const error = new Error('Las fechas del periodo de inhabilitación no tienen un formato válido.');
      error.statusCode = 400;
      throw error;
    }

    if (finDate < inicioDate) {
      const error = new Error('La fecha de fin del periodo de inhabilitación debe ser igual o posterior a la fecha de inicio.');
      error.statusCode = 400;
      throw error;
    }

    if (!motivoRaw) {
      const error = new Error('Debe especificar el motivo de la inhabilitación temporal.');
      error.statusCode = 400;
      throw error;
    }

    const motivoSanitizado = motivoRaw.replace(/[|\[\]]/g, ' ').substring(0, 90).trim();
    const { observaciones_medicas } = extraerMetadataInhabilitacion(record.observaciones_medicas);
    const baseObs = (observaciones_medicas || 'Ninguna').substring(0, 75).trim();
    const etiquetaInhabilitacion = `[INHABILITADO|${fechaInicio}|${fechaFin}|${motivoSanitizado}]`;
    const nuevaCondicion = `${baseObs} ${etiquetaInhabilitacion}`.substring(0, 200);

    await alumnosRepository.inhabilitarAlumno(id, nuevaCondicion);

    const detalleActualizado = await this.obtenerDetalleAlumno(id);
    return detalleActualizado;
  }
}

module.exports = new AlumnosService();