const comprobantesService = require('./comprobantes.service');
const { generarReciboPdf } = require('./comprobantes.pdf');
const { successResponse, errorResponse } = require('../../shared/utils/response.util');

function responderError(res, error, mensaje) {
  if (error.status) {
    return errorResponse(res, error.status, error.message);
  }

  console.error(`${mensaje}:`, error);
  return errorResponse(res, 500, mensaje);
}

async function obtener(req, res) {
  try {
    const comprobante = await comprobantesService.obtenerComprobante(req.params.idPago);
    return successResponse(res, 200, comprobante, 'Comprobante generado');
  } catch (error) {
    return responderError(res, error, 'No se pudo cargar el comprobante');
  }
}

async function descargarPdf(req, res) {
  try {
    const comprobante = await comprobantesService.obtenerComprobante(req.params.idPago);
    const pdf = generarReciboPdf(comprobante.recibo);

    res.attachment(`recibo-${comprobante.id_pago}.pdf`);
    return pdf.pipe(res);
  } catch (error) {
    return responderError(res, error, 'No se pudo descargar el comprobante, intente nuevamente');
  }
}

module.exports = {
  obtener,
  descargarPdf
};
