const { QueueEvents } = require('bullmq');
const { randomUUID } = require('crypto');

const comprobantesService = require('./comprobantes.service');
const { generarReciboPdf } = require('./comprobantes.pdf');

const {
  createEmailTransactionalQueue,
  enqueueTransactionalEmail
} = require('../../shared/queues/email-transactional.queue');

const {
  QUEUE_NAMES
} = require('../../shared/queues/queue.constants');

const {
  redisConnection
} = require('../../shared/config/redis');

const emailQueue = createEmailTransactionalQueue();

const emailQueueEvents = new QueueEvents(
  QUEUE_NAMES.EMAIL_TRANSACTIONAL,
  {
    connection: redisConnection.duplicate()
  }
);

// Persistencia temporal mientras la tabla Envio_Comprobante
// no haya sido creada por el responsable de base de datos.
// Se reinicia cuando se reinicia el servidor.
const enviosTemporales = new Map();

emailQueueEvents.on('error', (error) => {
  console.error(
    `[HU-13][QUEUE_EVENTS_ERROR] ${error.message}`
  );
});

function crearError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// Convierte el PDF generado por HU-12 a Base64 para poder
// transportarlo de forma segura dentro del job de BullMQ.
function generarPdfBase64(recibo) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const pdf = generarReciboPdf(recibo);

    pdf.on('data', (chunk) => {
      chunks.push(chunk);
    });

    pdf.on('end', () => {
      resolve(
        Buffer.concat(chunks).toString('base64')
      );
    });

    pdf.on('error', reject);
  });
}

async function enviarComprobante(idPago) {
  // Reutiliza las validaciones y datos generados por HU-12.
  const comprobante =
    await comprobantesService.obtenerComprobante(idPago);

  if (!comprobante.correo) {
    throw crearError(
      422,
      'El alumno no tiene un correo registrado.'
    );
  }

  const ultimoEnvio = enviosTemporales.get(idPago);

  if (ultimoEnvio?.estado === 'PENDIENTE') {
    throw crearError(
      409,
      'El comprobante ya tiene un envío en proceso.'
    );
  }

  if (ultimoEnvio?.estado === 'ENVIADO') {
    throw crearError(
      409,
      'El comprobante ya fue enviado correctamente.'
    );
  }

  const intento = ultimoEnvio
    ? ultimoEnvio.intento + 1
    : 1;

  // Envío inicial + máximo 2 reenvíos manuales.
  if (intento > 3) {
    throw crearError(
      409,
      'Se alcanzó el máximo de 2 reenvíos permitidos.'
    );
  }

  const traceId = `hu13-${idPago}-${randomUUID()}`;

  enviosTemporales.set(idPago, {
    intento,
    estado: 'PENDIENTE',
    traceId
  });

  try {
    const pdfBase64 =
      await generarPdfBase64(comprobante.recibo);

    const job = await enqueueTransactionalEmail(
      emailQueue,
      {
        recipient: comprobante.correo,

        subject:
          `Comprobante de pago ${comprobante.numero} - Forca & Fitness`,

        template: 'comprobante-pago',

        context: {
          text:
            `Hola ${comprobante.alumno}.\n\n` +
            `Adjuntamos tu comprobante de pago ` +
            `${comprobante.numero}.\n\n` +
            'Academia Forca & Fitness.',

          attachments: [
            {
              filename: `recibo-${idPago}.pdf`,
              content: pdfBase64,
              encoding: 'base64',
              contentType: 'application/pdf'
            }
          ]
        },

        traceId
      }
    );

    await emailQueueEvents.waitUntilReady();

    const resultado = await job.waitUntilFinished(
      emailQueueEvents,
      60000
    );

    enviosTemporales.set(idPago, {
      intento,
      estado: 'ENVIADO',
      traceId,
      jobId: String(job.id),
      messageId: resultado.messageId
    });

    console.log(
      `[HU-13][ENVIADO] pago=${idPago} ` +
      `intento=${intento} job=${job.id} ` +
      `messageId=${resultado.messageId}`
    );

    return {
      id_pago: idPago,
      correo: comprobante.correo,
      comprobante: comprobante.numero,
      intento,
      estado: 'ENVIADO',
      job_id: String(job.id),
      message_id: resultado.messageId
    };
  } catch (error) {
    enviosTemporales.set(idPago, {
      intento,
      estado: 'ERROR',
      traceId,
      error: error.message
    });

    console.error(
      `[HU-13][ENVIO_ERROR] pago=${idPago} ` +
      `intento=${intento} error=${error.message}`
    );

    throw crearError(
      502,
      intento < 3
        ? `No se pudo enviar el comprobante. Puede reintentarlo ${
            3 - intento
          } vez/veces más.`
        : 'No se pudo enviar el comprobante y se alcanzó el máximo de reenvíos.'
    );
  }
}

module.exports = {
  enviarComprobante
};