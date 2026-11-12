const alumnosRepository = require('./alumnos.repository');

class AlumnosService {
  async listarDisciplinas() {
    return alumnosRepository.findAllDisciplinas();
  }

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
      const diffDays = fechaVencimiento ? Math.round(diffTime / (1000 * 60 * 60 * 24)) : null;
      
      const esReservada = al.estado === 'Reservada';
      let estado_matricula;
      if (esReservada) {
        estado_matricula = 'Reservada';
      } else if (!fechaVencimiento) {
        estado_matricula = al.estado ? 'Sin fecha de vencimiento' : 'Sin matr\u00edcula';
      } else if (diffDays < 0) {
        estado_matricula = 'Vencida';
      } else if (diffDays <= 3) {
        estado_matricula = 'Próxima a vencer';
      } else {
        estado_matricula = 'Activa';
      }
      
      const nombres = al.nombres || '';
      const apellidoPaterno = al.apellido_paterno || '';
      
      return {
        id: al.id,
        dni: al.dni,
        estado_alumno_registrado: al.estado_alumno_registrado,
        nombres: al.nombres,
        apellido_paterno: al.apellido_paterno,
        apellido_materno: al.apellido_materno,
        estado_matricula: estado_matricula,
        dias_restantes: diffDays,
        por_vencer: estado_matricula === 'Próxima a vencer',
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
    const diffDays = fechaVencimiento ? Math.round(diffTime / (1000 * 60 * 60 * 24)) : null;
    
    const esReservada = record.estado_matricula === 'Reservada';
    let estado;
    let dias_restantes_texto;

    if (esReservada) {
      estado = 'Reservada';
      dias_restantes_texto = 'Reservada - Inicia próximo periodo';
    } else if (!fechaVencimiento) {
      estado = record.estado_matricula ? 'Sin fecha de vencimiento' : 'Sin matrícula';
      dias_restantes_texto = record.estado_matricula
        ? 'No hay fecha de vencimiento registrada'
        : 'Sin matrícula registrada';
    } else if (diffDays < 0) {
      estado = 'Vencida';
      dias_restantes_texto = `Vencida hace ${Math.abs(diffDays)} día${Math.abs(diffDays) === 1 ? '' : 's'}`;
    } else if (diffDays <= 3) {
      estado = 'Próxima a vencer';
      dias_restantes_texto = diffDays === 0 ? 'Vence hoy' : `Próxima a vencer (${diffDays} día${diffDays === 1 ? '' : 's'} restante${diffDays === 1 ? '' : 's'})`;
    } else {
      estado = 'Activa';
      dias_restantes_texto = `Activa - ${diffDays} días restantes`;
    }

    const estado_alumno = esReservada
      ? 'Habilitado'
      : !fechaVencimiento
        ? 'Sin vigencia'
        : diffDays >= 0 ? 'Habilitado' : 'Inhabilitado';

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
      estado_alumno_registrado: record.estado_alumno_registrado,
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
      observaciones_medicas: record.observaciones_medicas
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
}

module.exports = new AlumnosService();