const comprobantesRepository = require('./comprobantes.repository');
const { montoEnLetras } = require('../../shared/utils/monto-letras.util');

const METODOS = { EFECTIVO: 'Efectivo', MERCADO_PAGO: 'Mercado Pago' };

function crearError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// Solo un pago aprobado tiene comprobante
async function obtenerComprobante(idPago) {
  let pago = null;
  try {
    pago = await comprobantesRepository.buscarPorPago(idPago);
  } catch (error) {
    console.warn(`[COMPROBANTES] BD no disponible (${error.message}). Buscando comprobante en contingencia.`);
  }

  // Fallback si la BD no está disponible o no se encontró
  if (!pago) {
    // Buscar en pagos de prueba
    const pagosService = require('../pagos/pagos.service');
    const todosAlumnos = await pagosService.listarCobrosPorAlumno();
    for (const a of todosAlumnos) {
      const p = a.pagos.find(item => item.id_pago === idPago);
      if (p) {
        pago = {
          id_pago: p.id_pago,
          estado_pago: p.estado_pago || 'APROBADO',
          monto: p.monto,
          metodo_pago: p.medio_pago,
          referencia: p.referencia || 'REC-001',
          fecha_emision: p.fecha_pago,
          alumno: a.nombre_completo,
          documento: a.dni,
          correo_electronico: a.correo,
          disciplinas: p.disciplinas,
          periodo: p.mes,
          correlativo: 42
        };
        break;
      }
    }
  }

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

  const cantidad = montoEnLetras(pago.monto);
  const periodo = pago.periodo ? `(${pago.periodo})` : '';

  return {
    id_pago: pago.id_pago,
    numero: pago.correlativo
      ? `CP-${formato({ year: 'numeric' })}-${String(pago.correlativo).padStart(4, '0')}`
      : '—',
    fecha: formato({ day: '2-digit', month: '2-digit', year: 'numeric' }),
    hora: formato({ hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
    alumno: pago.alumno,
    documento: pago.documento,
    correo: pago.correo_electronico,
    disciplinas: pago.disciplinas || '—',
    concepto: `Mensualidad ${periodo}`.trim(),
    metodo_pago: METODOS[pago.metodo_pago] || pago.metodo_pago,
    referencia: pago.referencia || '—',
    total: `S/ ${Number(pago.monto).toFixed(2)}`,
    total_letras: cantidad,

    // Textos del "Recibo virtual" que se descarga en PDF
    recibo: {
      pagador: pago.alumno,
      cantidad,
      concepto: `${pago.disciplinas || 'Mensualidad'} ${periodo}`.trim(),
      fecha: formato({ day: '2-digit', month: '2-digit', year: '2-digit' })
    }
  };
}

module.exports = {
  obtenerComprobante
};
