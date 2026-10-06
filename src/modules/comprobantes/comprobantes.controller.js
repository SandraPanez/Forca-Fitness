const comprobantesService = require('./comprobantes.service');
const { successResponse, errorResponse } = require('../../shared/utils/response.util');

async function obtener(req, res) {
  try {
    const comprobante = await comprobantesService.obtenerComprobante(req.params.idPago);
    return successResponse(res, 200, comprobante, 'Comprobante generado');
  } catch (error) {
    if (error.status) {
      return errorResponse(res, error.status, error.message);
    }

    console.error('Error al generar el comprobante:', error);
    return errorResponse(res, 500, 'No se pudo cargar el comprobante');
  }
}

module.exports = {
  obtener
};
