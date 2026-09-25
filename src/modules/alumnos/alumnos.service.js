const alumnosRepository = require('./alumnos.repository');

class AlumnosService {
  async listarAlumnos() {
    const records = await alumnosRepository.findAllAlumnos();
    
    // Procesar datos (calcular días restantes, iniciales, etc)
    return records.map(al => {
      const hoy = new Date();
      // Supongamos 30 días por matrícula por defecto (Regla de negocio)
      const fechaVencimiento = new Date(al.fecha_matricula);
      fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);
      
      const diffTime = fechaVencimiento - hoy;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      let estado_matricula = diffDays > 0 ? 'Activa' : 'Vencida';
      
      return {
        id: al.id,
        nombres: al.nombres,
        apellido_paterno: al.apellido_paterno,
        apellido_materno: al.apellido_materno,
        estado_matricula: estado_matricula,
        dias_restantes: diffDays,
        iniciales: `${al.nombres.charAt(0)}${al.apellido_paterno.charAt(0)}`.toUpperCase()
      };
    });
  }

  async obtenerDetalleAlumno(id) {
    const record = await alumnosRepository.findAlumnoById(id);
    if (!record) return null;

    // Supongamos 30 días de vigencia
    const hoy = new Date();
    const fechaVencimiento = new Date(record.fecha_matricula);
    fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);
    
    const diffTime = fechaVencimiento - hoy;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const estado = diffDays > 0 ? 'Activa' : 'Vencida';
    const dias_restantes_texto = diffDays > 0 
      ? `Activa - ${diffDays} días restantes` 
      : `Vencida hace ${Math.abs(diffDays)} días`;
    const estado_alumno = diffDays > 0 ? 'Habilitado' : 'Inhabilitado';

    return {
      nombre_completo: `${record.nombres} ${record.apellido_paterno} ${record.apellido_materno}`,
      estado: estado,
      dni: record.numero_documento,
      correo: record.correo_electronico,
      celular: record.numero_celular || 'No registrado',
      // Formatear fecha de nacimiento (YYYY-MM-DD a DD/MM/YYYY)
      fecha_nacimiento: new Date(record.fecha_nacimiento).toLocaleDateString('es-PE'),
      direccion: record.direccion || 'No registrada',
      disciplinas: record.disciplinas || 'Ninguna',
      fecha_inscripcion: new Date(record.fecha_matricula).toLocaleDateString('es-PE'),
      dias_restantes_texto: dias_restantes_texto,
      estado_alumno: estado_alumno,
      observaciones_medicas: record.observaciones_medicas
    };
  }
}

module.exports = new AlumnosService();
