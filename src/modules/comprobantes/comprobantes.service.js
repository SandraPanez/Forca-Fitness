const comprobantesRepository = require('./comprobantes.repository');

function crearError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// Solo un pago aprobado tiene comprobante
async function obtenerComprobante(idPago) {
  const pago = await comprobantesRepository.buscarPorPago(idPago);

  if (!pago) {
    throw crearError(404, 'No existe el pago indicado');
  }

  if (pago.estado_pago !== 'APROBADO') {
    throw crearError(409, 'El pago no fue aprobado, no se generó el comprobante');
  }

  return {
    id_pago: pago.id_pago
  };
}

module.exports = {
  obtenerComprobante
};
