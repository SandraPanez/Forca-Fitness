
const alumnosRepository = require('./alumnos.repository');

const MILISEGUNDOS_DIA = 24 * 60 * 60 * 1000;
const INHABILITACION_REGEX = /\[INHABILITADO\|([^|]*)\|([^|]*)\|([^\]]*)\]/;

// Trabaja con fechas de calendario, sin calcular vencimientos por horas.
const obtenerFechaCalendario = (valor) => {
  if (!valor) return null;

  if (typeof valor === 'string') {
    const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor.trim());

    if (partes) {
      const anio = Number(partes[1]);
      const mes = Number(partes[2]);
      const dia = Number(partes[3]);
      const fecha = new Date(Date.UTC(anio, mes - 1, dia));

      if (
        fecha.getUTCFullYear() !== anio ||
        fecha.getUTCMonth() + 1 !== mes ||
        fecha.getUTCDate() !== dia
      ) {
        return null;
      }

      return { anio, mes, dia };
    }
  }

  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return null;

  return {
    anio: fecha.getFullYear(),
    mes: fecha.getMonth() + 1,
    dia: fecha.getDate()
  };
};

const fechaISO = (valor) => {
  const fecha = obtenerFechaCalendario(valor);
  if (!fecha) return null;

  return `${String(fecha.anio).padStart(4, '0')}-${String(fecha.mes).padStart(2, '0')}-${String(fecha.dia).padStart(2, '0')}`;
};

const formatearFecha = (valor) => {
  const fecha = obtenerFechaCalendario(valor);
  if (!fecha) return 'No registrada';

  return `${String(fecha.dia).padStart(2, '0')}/${String(fecha.mes).padStart(2, '0')}/${fecha.anio}`;
};

const calcularDiasRestantes = (fechaFin) => {
  const vencimiento = obtenerFechaCalendario(fechaFin);
  if (!vencimiento) return null;

  const hoy = new Date();
  const diaActual = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const diaVencimiento = Date.UTC(
    vencimiento.anio,
    vencimiento.mes - 1,
    vencimiento.dia
  );

  return Math.round((diaVencimiento - diaActual) / MILISEGUNDOS_DIA);
};

const esEstadoInhabilitado = (estadoAlumnoDb) =>
  String(estadoAlumnoDb || '').trim().toUpperCase() === 'INHABILITADO';

const obtenerEstadoAlumno = (estadoAlumnoDb) => {
  const estado = String(estadoAlumnoDb || '').trim().toUpperCase();

  if (estado === 'INHABILITADO') return 'Inhabilitado';
  if (estado === 'INACTIVO') return 'Inactivo';
  if (estado === 'ACTIVO') return 'Activo';
  return String(estadoAlumnoDb || '').trim() || 'Sin estado';
};

function extraerMetadataInhabilitacion(condicionRaw) {
  const texto = String(condicionRaw || '');
  const match = texto.match(INHABILITACION_REGEX);
  const observacionesLimpias = texto.replace(INHABILITACION_REGEX, '').trim() || 'Ninguna';

  return {
    observaciones_medicas: observacionesLimpias,
    inhabilitacion: match ? {
      fecha_inicio: match[1] || null,
      fecha_fin: match[2] || null,
      motivo: match[3] || 'Inhabilitación temporal'
    } : null
  };
}

// Mantiene separados el estado de la matrícula y el estado del alumno.
const obtenerEstadoMatricula = (estadoBDRaw, diasRestantes) => {
  const estadoBD = String(estadoBDRaw || '').trim().toUpperCase();

  if (!estadoBD) return 'Sin matrícula';
  if (estadoBD === 'RESERVADA') return 'Reservada';
  if (estadoBD === 'INHABILITADA' || estadoBD === 'INHABILITADO') return 'Inhabilitada';
  if (estadoBD === 'PENDIENTE') return 'Pendiente';
  if (diasRestantes === null) return 'Sin fecha de vencimiento';
  if (estadoBD === 'VENCIDA' || diasRestantes < 0) return 'Vencida';

  if (estadoBD === 'ACTIVA' || estadoBD === 'ACTIVO') {
    return diasRestantes <= 3 ? 'Próxima a vencer' : 'Activa';
  }

  // Si la BD tiene otro estado, no convertirlo arbitrariamente a "Activa".
  return String(estadoBDRaw).trim();
};

const obtenerTextoVigencia = (estado, diasRestantes) => {
  switch (estado) {
    case 'Reservada':
      return 'Reservada - Inicia próximo periodo';
    case 'Sin matrícula':
      return 'Sin matrícula registrada';
    case 'Sin fecha de vencimiento':
      return 'No hay fecha de vencimiento registrada';
    case 'Inhabilitada':
      return 'Matrícula inhabilitada';
    case 'Vencida':
      return diasRestantes !== null && diasRestantes < 0
        ? `Vencida hace ${Math.abs(diasRestantes)} día${Math.abs(diasRestantes) === 1 ? '' : 's'}`
        : 'Matrícula vencida';
    case 'Próxima a vencer':
      if (diasRestantes === 0) return 'Vence hoy';
      return `Próxima a vencer (${diasRestantes} día${diasRestantes === 1 ? '' : 's'} restante${diasRestantes === 1 ? '' : 's'})`;
    case 'Activa':
      return diasRestantes === 0
        ? 'Activa - vence hoy'
        : `Activa - ${diasRestantes} días restantes`;
    default:
      return estado || 'Sin información de matrícula';
  }
};

class AlumnosService {
  async listarDisciplinas() {
    return alumnosRepository.findAllDisciplinas();
  }

  async listarAlumnos(idProfesor = null) {
    const records = await alumnosRepository.findAllAlumnos(idProfesor);

    return records.map(alumno => {
      // La fecha real viene de Detalles_Matricula; no inventar 30 días.
      const vencimientoISO = fechaISO(alumno.fecha_fin);
      const diasRestantes = calcularDiasRestantes(vencimientoISO);
      const estadoMatriculaReal = obtenerEstadoMatricula(alumno.estado, diasRestantes);
      const estadoRegistrado = alumno.estado_alumno_registrado || alumno.estado_alumno;
      const inhabilitado = esEstadoInhabilitado(estadoRegistrado);
      const { inhabilitacion } = extraerMetadataInhabilitacion(alumno.observaciones_medicas);
      const nombres = alumno.nombres || '';
      const apellidoPaterno = alumno.apellido_paterno || '';

      return {
        id: alumno.id,
        dni: alumno.dni,
        estado_alumno_registrado: estadoRegistrado,
        nombres: alumno.nombres,
        apellido_paterno: alumno.apellido_paterno,
        apellido_materno: alumno.apellido_materno,
        estado_matricula: inhabilitado ? 'Inhabilitada' : estadoMatriculaReal,
        estado_matricula_real: estadoMatriculaReal,
        estado_alumno: obtenerEstadoAlumno(estadoRegistrado),
        inhabilitado,
        periodo_inhabilitacion: inhabilitacion,
        dias_restantes: diasRestantes,
        por_vencer: !inhabilitado && estadoMatriculaReal === 'Próxima a vencer',
        fecha_fin: vencimientoISO,
        fecha_vencimiento: vencimientoISO,
        disciplinas: alumno.disciplinas || [],
        iniciales: `${nombres.charAt(0)}${apellidoPaterno.charAt(0)}`.toUpperCase()
      };
    });
  }

  async obtenerDetalleAlumno(id, idProfesor = null) {
    const record = await alumnosRepository.findAlumnoById(id, idProfesor);
    if (!record) return null;

    // Priorizar la fecha del detalle seleccionado para coincidir con el listado.
    const vencimientoISO = fechaISO(record.fecha_fin) || fechaISO(record.fecha_vencimiento);
    const diasRestantes = calcularDiasRestantes(vencimientoISO);
    const estadoMatriculaReal = obtenerEstadoMatricula(record.estado_matricula, diasRestantes);
    const estadoRegistrado = record.estado_alumno_registrado || record.estado_alumno_db;
    const inhabilitado = esEstadoInhabilitado(estadoRegistrado);
    const { observaciones_medicas, inhabilitacion } = extraerMetadataInhabilitacion(
      record.observaciones_medicas
    );

    const formatearFechaIso = (fechaStr) =>
      fechaStr ? formatearFecha(fechaStr) : 'No especificado';

    return {
      id: record.id,
      nombre_completo: [
        record.nombres,
        record.apellido_paterno,
        record.apellido_materno
      ].filter(Boolean).join(' '),
      estado: inhabilitado ? 'Inhabilitada' : estadoMatriculaReal,
      estado_alumno_registrado: estadoRegistrado,
      estado_matricula_real: estadoMatriculaReal,
      dni: record.numero_documento,
      correo: record.correo_electronico,
      celular: record.numero_celular || 'No registrado',
      fecha_nacimiento: formatearFecha(record.fecha_nacimiento),
      direccion: record.direccion || 'No registrada',
      disciplinas: record.disciplinas || 'Ninguna',
      fecha_inscripcion: formatearFecha(record.fecha_matricula),
      fecha_inicio: formatearFecha(record.fecha_inicio),
      fecha_fin: vencimientoISO,
      fecha_vencimiento: formatearFecha(vencimientoISO),
      dias_restantes: diasRestantes,
      dias_restantes_texto: obtenerTextoVigencia(estadoMatriculaReal, diasRestantes),
      estado_alumno: obtenerEstadoAlumno(estadoRegistrado),
      inhabilitado,
      inhabilitacion: inhabilitacion ? {
        fecha_inicio: inhabilitacion.fecha_inicio,
        fecha_fin: inhabilitacion.fecha_fin,
        fecha_inicio_formato: formatearFechaIso(inhabilitacion.fecha_inicio),
        fecha_fin_formato: formatearFechaIso(inhabilitacion.fecha_fin),
        motivo: inhabilitacion.motivo
      } : null,
      observaciones_medicas
    };
  }

  async obtenerHistorialMatriculas(id) {
    const alumno = await alumnosRepository.findNombreAlumnoById(id);
    if (!alumno) return null;

    const registros = await alumnosRepository.findHistorialMatriculasByAlumno(id);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const aFecha = texto => new Date(`${texto}T00:00:00`);

    const matriculas = registros.map(reg => {
      const inicio = aFecha(reg.fecha_inicio);
      const fin = aFecha(reg.fecha_fin);

      let estado;
      if (inicio > hoy) {
        estado = 'Reservada';
      } else if (fin < hoy) {
        estado = 'Vencida';
      } else {
        estado = 'Activa';
      }

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
      alumno: {
        id: alumno.id,
        nombre_completo: alumno.nombre_completo
      },
      permanencia: this.calcularPermanencia(registros, hoy),
      matriculas
    };
  }

  // Resumen de permanencia del alumno, sin modificar datos históricos.
  calcularPermanencia(registros, hoy = new Date()) {
    if (!registros.length) return null;

    const inicios = registros.map(r => new Date(`${r.fecha_inicio}T00:00:00`));
    const fines = registros.map(r => new Date(`${r.fecha_fin}T00:00:00`));
    const primerInicio = new Date(Math.min(...inicios));
    const ultimoFin = new Date(Math.max(...fines));
    const referencia = ultimoFin < hoy ? ultimoFin : hoy;

    const dias = Math.max(0, Math.round((referencia - primerInicio) / MILISEGUNDOS_DIA));
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

    if (esEstadoInhabilitado(record.estado_alumno_db || record.estado_alumno_registrado)) {
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

    if (fechaISO(fechaInicio) !== fechaInicio || fechaISO(fechaFin) !== fechaFin) {
      const error = new Error('Las fechas del periodo de inhabilitación deben tener un formato válido (AAAA-MM-DD).');
      error.statusCode = 400;
      throw error;
    }

    if (fechaFin < fechaInicio) {
      const error = new Error('La fecha de fin del periodo de inhabilitación debe ser igual o posterior a la fecha de inicio.');
      error.statusCode = 400;
      throw error;
    }

    if (!motivoRaw) {
      const error = new Error('Debe especificar el motivo de la inhabilitación temporal.');
      error.statusCode = 400;
      throw error;
    }

    const motivoSanitizado = motivoRaw
      .replace(/[|\[\]]/g, ' ')
      .substring(0, 90)
      .trim();

    if (!motivoSanitizado) {
      const error = new Error('El motivo de inhabilitación no puede estar vacío.');
      error.statusCode = 400;
      throw error;
    }

    const { observaciones_medicas } = extraerMetadataInhabilitacion(record.observaciones_medicas);
    const etiquetaInhabilitacion = `[INHABILITADO|${fechaInicio}|${fechaFin}|${motivoSanitizado}]`;

    // Evita truncar la etiqueta y perder los metadatos de inhabilitación.
    const espacioDisponible = Math.max(0, 200 - etiquetaInhabilitacion.length - 1);
    const baseObs = (observaciones_medicas || 'Ninguna')
      .substring(0, Math.min(75, espacioDisponible))
      .trim();

    const nuevaCondicion = baseObs
      ? `${baseObs} ${etiquetaInhabilitacion}`
      : etiquetaInhabilitacion;

    const actualizado = await alumnosRepository.inhabilitarAlumno(id, nuevaCondicion);

    if (!actualizado) {
      const error = new Error('Alumno no encontrado.');
      error.statusCode = 404;
      throw error;
    }

    return this.obtenerDetalleAlumno(id);
  }
}

module.exports = new AlumnosService();
