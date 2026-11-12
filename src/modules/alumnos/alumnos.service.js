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
  async listarAlumnos() {
    const records = await alumnosRepository.findAllAlumnos();
    
    return records.map(al => {
      const hoy = new Date();
      const fechaVencimiento = new Date(al.fecha_matricula);
      fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);
      
      const diffTime = fechaVencimiento - hoy;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      const inhabilitado = esEstadoInhabilitado(al.estado_alumno);
      const { inhabilitacion } = extraerMetadataInhabilitacion(al.observaciones_medicas);

      let estado_matricula = diffDays > 0 ? 'Activa' : 'Vencida';
      if (inhabilitado) {
        estado_matricula = 'Inhabilitada';
      }
      
      return {
        id: al.id,
        nombres: al.nombres,
        apellido_paterno: al.apellido_paterno,
        apellido_materno: al.apellido_materno,
        estado_matricula: estado_matricula,
        estado_matricula_real: diffDays > 0 ? 'Activa' : 'Vencida',
        estado_alumno: inhabilitado ? 'Inhabilitado' : 'Habilitado',
        inhabilitado: inhabilitado,
        periodo_inhabilitacion: inhabilitacion,
        dias_restantes: diffDays,
        iniciales: `${(al.nombres || '').charAt(0)}${(al.apellido_paterno || '').charAt(0)}`.toUpperCase()
      };
    });
  }

  async obtenerDetalleAlumno(id) {
    const record = await alumnosRepository.findAlumnoById(id);
    if (!record) return null;

    const hoy = new Date();
    const fechaVencimiento = new Date(record.fecha_matricula);
    fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);
    
    const diffTime = fechaVencimiento - hoy;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const inhabilitado = esEstadoInhabilitado(record.estado_alumno_db);
    const { observaciones_medicas, inhabilitacion } = extraerMetadataInhabilitacion(record.observaciones_medicas);

    const estado_matricula_real = diffDays > 0 ? 'Activa' : 'Vencida';
    const estado = inhabilitado ? 'Inhabilitada' : estado_matricula_real;
    const dias_restantes_texto = diffDays > 0 
      ? `Activa - ${diffDays} días restantes` 
      : `Vencida hace ${Math.abs(diffDays)} días`;
    const estado_alumno = inhabilitado ? 'Inhabilitado' : (diffDays > 0 ? 'Habilitado' : 'Inhabilitado');

    const formatearFecha = (fechaStr) => {
      if (!fechaStr) return 'No especificado';
      const partes = String(fechaStr).split('-');
      if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
      }
      const d = new Date(fechaStr);
      return Number.isNaN(d.getTime()) ? fechaStr : d.toLocaleDateString('es-PE');
    };

    return {
      id: record.id,
      nombre_completo: `${record.nombres} ${record.apellido_paterno} ${record.apellido_materno}`,
      estado: estado,
      estado_matricula_real: estado_matricula_real,
      dni: record.numero_documento,
      correo: record.correo_electronico,
      celular: record.numero_celular || 'No registrado',
      fecha_nacimiento: new Date(record.fecha_nacimiento).toLocaleDateString('es-PE'),
      direccion: record.direccion || 'No registrada',
      disciplinas: record.disciplinas || 'Ninguna',
      fecha_inscripcion: record.fecha_matricula ? new Date(record.fecha_matricula).toLocaleDateString('es-PE') : 'No registrada',
      dias_restantes_texto: dias_restantes_texto,
      estado_alumno: estado_alumno,
      inhabilitado: inhabilitado,
      inhabilitacion: inhabilitacion ? {
        fecha_inicio: inhabilitacion.fecha_inicio,
        fecha_fin: inhabilitacion.fecha_fin,
        fecha_inicio_formato: formatearFecha(inhabilitacion.fecha_inicio),
        fecha_fin_formato: formatearFecha(inhabilitacion.fecha_fin),
        motivo: inhabilitacion.motivo
      } : null,
      observaciones_medicas: observaciones_medicas
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