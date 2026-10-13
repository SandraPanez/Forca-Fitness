const alumnosRepository = require('./alumnos.repository');

class AlumnosService {
  async listarAlumnos(idProfesor = null) {
    const records = await alumnosRepository.findAllAlumnos(idProfesor);
    
    return records.map(al => {
      const hoy = new Date();
      const fechaInscripcion = al.fecha_matricula ? new Date(al.fecha_matricula) : null;
      const fechaVencimiento = fechaInscripcion && !Number.isNaN(fechaInscripcion.getTime())
        ? new Date(fechaInscripcion)
        : null;
      if (fechaVencimiento) {
        fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);
      }
      
      const diffTime = fechaVencimiento ? fechaVencimiento - hoy : 0;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      const estado_matricula = diffDays > 0 ? 'Activa' : 'Vencida';
      const nombres = al.nombres || '';
      const apellidoPaterno = al.apellido_paterno || '';
      
      return {
        id: al.id,
        nombres: al.nombres,
        apellido_paterno: al.apellido_paterno,
        apellido_materno: al.apellido_materno,
        estado_matricula: estado_matricula,
        dias_restantes: diffDays,
        disciplinas: al.disciplinas || [],
        iniciales: `${nombres.charAt(0)}${apellidoPaterno.charAt(0)}`.toUpperCase()
      };
    });
  }

  async obtenerDetalleAlumno(id, idProfesor = null) {
    const record = await alumnosRepository.findAlumnoById(id, idProfesor);
    if (!record) return null;

    const hoy = new Date();
    const fechaInscripcion = record.fecha_matricula ? new Date(record.fecha_matricula) : null;
    const fechaVencimiento = fechaInscripcion && !Number.isNaN(fechaInscripcion.getTime())
      ? new Date(fechaInscripcion)
      : null;
    if (fechaVencimiento) {
      fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);
    }
    
    const diffTime = fechaVencimiento ? fechaVencimiento - hoy : 0;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const estado = diffDays > 0 ? 'Activa' : 'Vencida';
    const dias_restantes_texto = diffDays > 0 
      ? `Activa - ${diffDays} días restantes` 
      : `Vencida hace ${Math.abs(diffDays)} días`;
    const estado_alumno = diffDays > 0 ? 'Habilitado' : 'Inhabilitado';

    const formatoFecha = fecha => {
      if (!fecha) return 'No registrada';
      const fechaFormateada = new Date(fecha);
      return Number.isNaN(fechaFormateada.getTime())
        ? 'No registrada'
        : fechaFormateada.toLocaleDateString('es-PE');
    };

    return {
      nombre_completo: [record.nombres, record.apellido_paterno, record.apellido_materno]
        .filter(Boolean)
        .join(' '),
      estado: estado,
      dni: record.numero_documento,
      correo: record.correo_electronico,
      celular: record.numero_celular || 'No registrado',
      fecha_nacimiento: formatoFecha(record.fecha_nacimiento),
      direccion: record.direccion || 'No registrada',
      disciplinas: record.disciplinas || 'Ninguna',
      fecha_inscripcion: formatoFecha(record.fecha_matricula),
      dias_restantes_texto: dias_restantes_texto,
      estado_alumno: estado_alumno,
      observaciones_medicas: record.observaciones_medicas
    };
  }
}

module.exports = new AlumnosService();