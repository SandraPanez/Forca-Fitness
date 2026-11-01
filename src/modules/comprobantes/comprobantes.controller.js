const comprobantesService = require('./comprobantes.service');
const comprobantesEnvioService = require('./comprobantes-envio.service');
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
    const comprobante = await comprobantesService.obtenerComprobante(
      req.params.idPago
    );

    return successResponse(
      res,
      200,
      comprobante,
      'Comprobante generado'
    );
  } catch (error) {
    return responderError(
      res,
      error,
      'No se pudo cargar el comprobante'
    );
  }
}

async function descargarPdf(req, res) {
  try {
    const comprobante = await comprobantesService.obtenerComprobante(
      req.params.idPago
    );

    const pdf = generarReciboPdf(comprobante.recibo);

    res.setHeader('Content-Type', 'application/pdf');
    res.attachment(`recibo-${comprobante.id_pago}.pdf`);

    return pdf.pipe(res);
  } catch (error) {
    return responderError(
      res,
      error,
      'No se pudo descargar el comprobante, intente nuevamente'
    );
  }
}

// Envia el comprobante al correo registrado del alumno.
async function enviarPorCorreo(req, res) {
  try {
    const resultado =
      await comprobantesEnvioService.enviarComprobante(
        req.params.idPago
      );

    return successResponse(
      res,
      200,
      resultado,
      'Comprobante enviado correctamente al correo del alumno'
    );
  } catch (error) {
    return responderError(
      res,
      error,
      'No se pudo enviar el comprobante por correo'
    );
  }
}

module.exports = {
  obtener,
  descargarPdf,
  enviarPorCorreo
};
