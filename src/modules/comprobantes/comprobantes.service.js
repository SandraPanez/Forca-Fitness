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

  const emision = new Date(pago.fecha_emision);
  const formato = (opciones) => new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    ...opciones
  }).format(emision);

  return {
    id_pago: pago.id_pago,
    numero: pago.correlativo
      ? `CP-${formato({ year: 'numeric' })}-${String(pago.correlativo).padStart(4, '0')}`
      : '—',
    fecha: formato({ day: '2-digit', month: '2-digit', year: 'numeric' }),
    hora: formato({ hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  };
}

module.exports = {
  obtenerComprobante
};
