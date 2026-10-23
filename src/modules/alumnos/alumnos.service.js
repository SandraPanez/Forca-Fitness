
const alumnosRepository = require('./alumnos.repository');

const MILISEGUNDOS_DIA = 24 * 60 * 60 * 1000;

// Obtiene los componentes de una fecha sin depender de la hora.
const obtenerFechaCalendario = (valor) => {
  if (!valor) return null;

  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [anio, mes, dia] = valor.split('-').map(Number);
    return { anio, mes, dia };
  }

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return null;
  }

  return {
    anio: fecha.getFullYear(),
    mes: fecha.getMonth() + 1,
    dia: fecha.getDate()
  };
};

// Calcula los días restantes utilizando Fecha_Fin.
const calcularDiasRestantes = (fechaFin) => {
  const vencimiento = obtenerFechaCalendario(fechaFin);

  if (!vencimiento) {
    return null;
  }

  const hoy = new Date();

  const diaActual = Date.UTC(
    hoy.getFullYear(),
    hoy.getMonth(),
    hoy.getDate()
  );

  const diaVencimiento = Date.UTC(
    vencimiento.anio,
    vencimiento.mes - 1,
    vencimiento.dia
  );

  return Math.round(
    (diaVencimiento - diaActual) / MILISEGUNDOS_DIA
  );
};

// Determina el estado según la base de datos y la fecha real.
const obtenerEstadoMatricula = (registro, diasRestantes) => {
  const estadoBD = String(
    registro.estado_matricula ?? registro.estado ?? ''
  ).trim().toUpperCase();

  const activaEnBD = ['ACTIVA', 'ACTIVO'].includes(estadoBD);

  if (
    activaEnBD &&
    diasRestantes !== null &&
    diasRestantes >= 0
  ) {
    return 'Activa';
  }

  if (diasRestantes !== null && diasRestantes < 0) {
    return 'Vencida';
  }

  return 'Inhabilitada';
};

const formatearFecha = (valor) => {
  const fecha = obtenerFechaCalendario(valor);

  if (!fecha) return 'No registrada';

  return new Date(
    fecha.anio,
    fecha.mes - 1,
    fecha.dia
  ).toLocaleDateString('es-PE');
};

const fechaISO = (valor) => {
  const fecha = obtenerFechaCalendario(valor);

  if (!fecha) return null;

  const anio = String(fecha.anio).padStart(4, '0');
  const mes = String(fecha.mes).padStart(2, '0');
  const dia = String(fecha.dia).padStart(2, '0');

  return `${anio}-${mes}-${dia}`;
};

class AlumnosService {
  async listarAlumnos(idProfesor = null) {
    const records = await alumnosRepository.findAllAlumnos(idProfesor);

    return records.map((alumno) => {
      const diasRestantes = calcularDiasRestantes(alumno.fecha_fin);

      const estadoMatricula = obtenerEstadoMatricula(
        alumno,
        diasRestantes
      );

      const nombres = alumno.nombres || '';
      const apellidoPaterno = alumno.apellido_paterno || '';

      return {
        id: alumno.id,
        nombres: alumno.nombres,
        apellido_paterno: alumno.apellido_paterno,
        apellido_materno: alumno.apellido_materno,

        estado_matricula: estadoMatricula,
        dias_restantes: diasRestantes,

        fecha_fin: fechaISO(alumno.fecha_fin),

        disciplinas: alumno.disciplinas || [],

        iniciales: (
          nombres.charAt(0) + apellidoPaterno.charAt(0)
        ).toUpperCase()
      };
    });
  }

  async obtenerDetalleAlumno(id, idProfesor = null) {
    const record = await alumnosRepository.findAlumnoById(
      id,
      idProfesor
    );

    if (!record) return null;

    const diasRestantes = calcularDiasRestantes(record.fecha_fin);

    const estado = obtenerEstadoMatricula(
      record,
      diasRestantes
    );

    let diasRestantesTexto;

    if (estado === 'Activa') {
      diasRestantesTexto = diasRestantes === 0
        ? 'Activa - vence hoy'
        : `Activa - ${diasRestantes} días restantes`;
    } else if (estado === 'Vencida') {
      diasRestantesTexto =
        `Vencida hace ${Math.abs(diasRestantes)} días`;
    } else {
      diasRestantesTexto = 'Matrícula inhabilitada';
    }

    const estadoAlumno = estado === 'Activa'
      ? 'Habilitado'
      : 'Inhabilitado';

    return {
      nombre_completo: [
        record.nombres,
        record.apellido_paterno,
        record.apellido_materno
      ].filter(Boolean).join(' '),

      estado: estado,

      dni: record.numero_documento,
      correo: record.correo_electronico,
      celular: record.numero_celular || 'No registrado',

      fecha_nacimiento: formatearFecha(
        record.fecha_nacimiento
      ),

      direccion: record.direccion || 'No registrada',

      disciplinas: record.disciplinas || 'Ninguna',

      fecha_inscripcion: formatearFecha(
        record.fecha_matricula
      ),

      fecha_vencimiento: formatearFecha(
        record.fecha_fin
      ),

      dias_restantes: diasRestantes,
      dias_restantes_texto: diasRestantesTexto,

      estado_alumno: estadoAlumno,

      observaciones_medicas: record.observaciones_medicas
    };
  }
}

module.exports = new AlumnosService();
