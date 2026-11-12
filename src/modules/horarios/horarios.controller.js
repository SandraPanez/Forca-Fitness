
const horariosService = require('./horarios.service');

const {
  generarTokenPreview,
  verificarTokenPreview
} = require('./horarios.preview-token');

class HorariosController {

  constructor() {
    this.listarClases = this.listarClases.bind(this);
    this.previsualizarCambio = this.previsualizarCambio.bind(this);
    this.confirmarCambio = this.confirmarCambio.bind(this);
  }

  // Listar todas las clases y sus horarios.
  async listarClases(req, res) {
    try {
      const clases = await horariosService.listarClases();

      return res.status(200).json({
        success: true,
        clases
      });

    } catch (error) {
      console.error('Error al listar clases:', error);

      return res.status(500).json({
        success: false,
        mensaje: 'No se pudieron obtener las clases.'
      });
    }
  }

  // Mostrar una vista previa sin guardar cambios.
  async previsualizarCambio(req, res) {
    try {
      const { idDiscHorario } = req.params;

      const {
        dias,
        hora_inicio,
        hora_fin
      } = req.body || {};

      if (!dias || !hora_inicio || !hora_fin) {
        return res.status(400).json({
          success: false,
          mensaje: 'Los dias y las horas son obligatorios.'
        });
      }

      const cambios = {
        dias,
        hora_inicio,
        hora_fin
      };

      // Validar primero la propuesta.
      const resultado = await horariosService.previsualizarCambio(
        idDiscHorario,
        cambios
      );

      // Asociar la vista previa al Director autenticado,
      // la clase y los cambios que acaba de revisar.
      const previewToken = generarTokenPreview(
        req.user.id,
        idDiscHorario,
        cambios
      );

      return res.status(200).json({
        success: true,
        ...resultado,
        preview_token: previewToken
      });

    } catch (error) {
      return this.manejarError(
        res,
        error,
        'No se pudo previsualizar el cambio.'
      );
    }
  }

  // Confirmar y guardar el horario en PostgreSQL.
  async confirmarCambio(req, res) {
    try {
      const { idDiscHorario } = req.params;

      const {
        dias,
        hora_inicio,
        hora_fin,
        preview_token
      } = req.body || {};

      if (!dias || !hora_inicio || !hora_fin) {
        return res.status(400).json({
          success: false,
          mensaje: 'Los dias y las horas son obligatorios.'
        });
      }

      const cambios = {
        dias,
        hora_inicio,
        hora_fin
      };

      // Exigir una vista previa valida del mismo Director.
      // Sin este token no se permite guardar.
      verificarTokenPreview(
        preview_token,
        req.user.id,
        idDiscHorario,
        cambios
      );

      // El servicio vuelve a validar los conflictos
      // dentro de la transaccion antes de guardar.
      const resultado = await horariosService.confirmarCambio(
        idDiscHorario,
        cambios
      );

      return res.status(200).json({
        success: true,
        ...resultado
      });

    } catch (error) {
      return this.manejarError(
        res,
        error,
        'No se pudo guardar el horario.'
      );
    }
  }

  // Controlar los errores de validacion y guardado.
  manejarError(res, error, mensajeGeneral) {
    const mensaje = error.message || '';

    let estado = 500;

    if (error.statusCode === 409) {
      estado = 409;

    } else if (
      mensaje === 'La clase seleccionada no existe.' ||
      mensaje === 'El horario asociado no existe.'
    ) {
      estado = 404;

    } else if (
      mensaje.includes('compartido por varias clases')
    ) {
      estado = 409;

    } else if (
      mensaje.includes('Debes seleccionar al menos un dia.') ||
      mensaje.includes('Dia no reconocido:') ||
      mensaje.includes('La hora debe tener formato HH:mm.') ||
      mensaje.includes('Las horas deben usar intervalos') ||
      mensaje.includes('La hora de fin debe ser posterior')
    ) {
      estado = 400;
    }

    if (estado === 500) {
      console.error('Error en horarios:', error);
    }

    const respuesta = {
      success: false,
      mensaje: estado === 500
        ? mensajeGeneral
        : mensaje
    };

    // Mostrar las clases que provocaron el conflicto.
    if (Array.isArray(error.conflictos)) {
      respuesta.conflictos = error.conflictos;
    }

    return res.status(estado).json(respuesta);
  }
}

module.exports = new HorariosController();
