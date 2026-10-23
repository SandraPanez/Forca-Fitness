const horariosRepository = require('./horarios.repository');

// Convencion de dias:
// L = Lunes
// M o MA = Martes
// X = Miercoles
// J = Jueves
// V = Viernes
// S = Sabado
// D = Domingo
//
// Compatibilidad con la base de datos:
// L-M-V antiguo = Lunes, Miercoles y Viernes
// M-J antiguo = Martes y Jueves

const DIAS = {
  L: 'L',
  LUNES: 'L',

  M: 'M',
  MA: 'M',
  MARTES: 'M',

  X: 'X',
  MIERCOLES: 'X',

  J: 'J',
  JUEVES: 'J',

  V: 'V',
  VIERNES: 'V',

  S: 'S',
  SABADO: 'S',

  D: 'D',
  DOMINGO: 'D'
};

const ORDEN_DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function normalizarDias(dias) {

  // Interpretar correctamente el formato antiguo.
  if (
    typeof dias === 'string' &&
    dias.toUpperCase().replace(/\s/g, '') === 'L-M-V'
  ) {
    return ['L', 'X', 'V'];
  }

  const valores = Array.isArray(dias)
    ? dias
    : typeof dias === 'string'
      ? dias.split(/[-,;]/)
      : [];

  if (!valores.length) {
    throw new Error('Debes seleccionar al menos un dia.');
  }

  const codigos = valores.map(dia => {

    const clave = String(dia)
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();

    if (!DIAS[clave]) {
      throw new Error(`Dia no reconocido: ${dia}`);
    }

    return DIAS[clave];
  });

  return ORDEN_DIAS.filter(
    dia => codigos.includes(dia)
  );
}

function horaEnMinutos(hora) {

  const resultado = /^([01]\d|2[0-3]):([0-5]\d)(?::00)?$/
    .exec(String(hora ?? ''));

  if (!resultado) {
    throw new Error('La hora debe tener formato HH:mm.');
  }

  const minutos =
    Number(resultado[1]) * 60 +
    Number(resultado[2]);

  if (minutos % 15 !== 0) {
    throw new Error(
      'Las horas deben usar intervalos de 15 minutos.'
    );
  }

  return minutos;
}

function formatearHora(minutos) {

  const horas = String(
    Math.floor(minutos / 60)
  ).padStart(2, '0');

  const mins = String(
    minutos % 60
  ).padStart(2, '0');

  return `${horas}:${mins}`;
}

// Rangos provisionales de turnos:
// Manana: antes de 12:00
// Tarde: de 12:00 a 17:59
// Noche: desde 18:00
function determinarTurno(minutosInicio) {

  if (minutosInicio < 12 * 60) {
    return 'Mañana';
  }

  if (minutosInicio < 18 * 60) {
    return 'Tarde';
  }

  return 'Noche';
}

class HorariosService {

  // Obtener clases y horarios.
  async listarClases() {
    return horariosRepository.listarClases();
  }

  // Validar una propuesta sin modificar la base de datos.
  // El parametro cliente permite usar la misma transaccion
  // durante la confirmacion del cambio.
  async previsualizarCambio(idDiscHorario, cambios, cliente) {

    const clases = await horariosRepository.listarClases(
      cliente
    );

    const claseActual = clases.find(
      clase => clase.id_disc_horario === idDiscHorario
    );

    if (!claseActual) {
      throw new Error('La clase seleccionada no existe.');
    }

    const nuevosDias = normalizarDias(cambios.dias);

    const nuevoInicio = horaEnMinutos(
      cambios.hora_inicio
    );

    const nuevoFin = horaEnMinutos(
      cambios.hora_fin
    );

    if (nuevoFin <= nuevoInicio) {
      throw new Error(
        'La hora de fin debe ser posterior a la hora de inicio.'
      );
    }

    const conflictos = [];
    const advertencias = [];

    for (const otraClase of clases) {

      if (
        otraClase.id_disc_horario === idDiscHorario
      ) {
        continue;
      }

      const diasOtraClase = normalizarDias(
        otraClase.dias
      );

      const compartenDia = nuevosDias.some(
        dia => diasOtraClase.includes(dia)
      );

      if (!compartenDia) {
        continue;
      }

      const otroInicio = horaEnMinutos(
        otraClase.hora_inicio
      );

      const otroFin = horaEnMinutos(
        otraClase.hora_fin
      );

      const hayCruce =
        nuevoInicio < otroFin &&
        nuevoFin > otroInicio;

      if (!hayCruce) {
        continue;
      }

      const detalle = {
        disciplina: otraClase.disciplina,
        profesor: otraClase.profesor_nombre,
        dias: otraClase.dias,
        hora_inicio: otraClase.hora_inicio,
        hora_fin: otraClase.hora_fin
      };

      if (
        claseActual.id_profesor === otraClase.id_profesor
      ) {
        conflictos.push(detalle);
      } else {
        advertencias.push(detalle);
      }
    }

    const alumnosActivos =
      await horariosRepository.contarAlumnosActivos(
        idDiscHorario,
        cliente
      );

    // Guardar martes como MA para evitar ambiguedades.
    const diasParaGuardar = nuevosDias
      .map(dia => dia === 'M' ? 'MA' : dia)
      .join('-');

    return {
      clase: claseActual,

      propuesta: {
        dias: diasParaGuardar,
        hora_inicio: formatearHora(nuevoInicio),
        hora_fin: formatearHora(nuevoFin),
        turno: determinarTurno(nuevoInicio)
      },

      alumnos_activos: alumnosActivos,

      aviso_alumnos: alumnosActivos > 0
        ? `Esta disciplina cuenta con ${alumnosActivos} alumnos matriculados activos.`
        : null,

      conflictos,
      advertencias,

      puede_confirmar: conflictos.length === 0
    };
  }

  // Confirmar y guardar un cambio de horario.
  async confirmarCambio(idDiscHorario, cambios) {

    return horariosRepository.ejecutarEnTransaccion(
      async (cliente) => {

        // Repetir las validaciones dentro de la transaccion.
        // No confiar solamente en una vista previa anterior.
        const vistaPrevia = await this.previsualizarCambio(
          idDiscHorario,
          cambios,
          cliente
        );

        // Bloquear si existe cruce con el mismo profesor.
        if (!vistaPrevia.puede_confirmar) {

          const error = new Error(
            'No se puede modificar el horario porque existen conflictos con otras clases del mismo profesor.'
          );

          error.statusCode = 409;
          error.conflictos = vistaPrevia.conflictos;

          throw error;
        }

        // Actualizar utilizando la misma transaccion.
        const horarioActualizado =
          await horariosRepository.actualizarHorarioExclusivo(
            idDiscHorario,
            vistaPrevia.propuesta,
            cliente
          );

        return {
          guardado: true,
          mensaje: 'Horario actualizado correctamente.',
          horario: horarioActualizado,
          alumnos_activos: vistaPrevia.alumnos_activos,
          aviso_alumnos: vistaPrevia.aviso_alumnos,
          advertencias: vistaPrevia.advertencias
        };
      }
    );
  }
}

module.exports = new HorariosService();