const { QueueEvents } = require('bullmq');
const { randomUUID } = require('crypto');

const comprobantesService = require('./comprobantes.service');
const { generarReciboPdf } = require('./comprobantes.pdf');

const {
  obtenerUltimoEnvio,
  crearEnvioPendiente,
  asignarJob,
  marcarEnviado,
  marcarError
} = require('./comprobantes-envio.repository');

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

// Convierte el PDF generado por HU-12 a Base64 para enviarlo
// como adjunto dentro del job de BullMQ.
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

  // La tabla real admite hasta 60 caracteres.
  if (comprobante.correo.length > 60) {
    throw crearError(
      422,
      'El correo registrado supera la longitud permitida.'
    );
  }

  // El ultimo envio se obtiene de PostgreSQL.
  const ultimoEnvio =
    await obtenerUltimoEnvio(idPago);

  if (ultimoEnvio?.estado === 'PENDIENTE') {
    throw crearError(
      409,
      'El comprobante ya tiene un envio en proceso.'
    );
  }

  if (ultimoEnvio?.estado === 'ENVIADO') {
    throw crearError(
      409,
      'El comprobante ya fue enviado correctamente.'
    );
  }

  const intento = ultimoEnvio
    ? Number(ultimoEnvio.intento) + 1
    : 1;

  // Envio inicial + maximo 2 reenvios manuales.
  if (intento > 3) {
    throw crearError(
      409,
      'Se alcanzo el maximo de 2 reenvios permitidos.'
    );
  }

  // Se mantiene por debajo de los 50 caracteres permitidos
  // por Trace_id en la tabla real.
  const traceId =
    `hu13-${idPago}-${randomUUID()
      .replace(/-/g, '')
      .slice(0, 20)}`;

  // Desde este punto el intento queda persistido en PostgreSQL.
  const envio = await crearEnvioPendiente({
    idPago,
    correoDestino: comprobante.correo,
    intento,
    traceId
  });

  let job = null;

  try {
    const pdfBase64 =
      await generarPdfBase64(comprobante.recibo);

    job = await enqueueTransactionalEmail(
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

    // Guarda el ID asignado por BullMQ.
    await asignarJob(
      envio.id_envio,
      idPago,
      String(job.id)
    );

    await emailQueueEvents.waitUntilReady();

    const resultado = await job.waitUntilFinished(
      emailQueueEvents,
      60000
    );

    if (!resultado?.messageId) {
      throw new Error(
        'El proveedor SMTP no devolvio un messageId.'
      );
    }

    // Persistimos el resultado final exitoso.
    await marcarEnviado(
      envio.id_envio,
      idPago,
      resultado.messageId
    );

    console.log(
      `[HU-13][ENVIADO] pago=${idPago} ` +
      `intento=${intento} job=${job.id} ` +
      `messageId=${resultado.messageId}`
    );

    return {
      id_pago: idPago,
      id_envio: envio.id_envio,
      correo: comprobante.correo,
      comprobante: comprobante.numero,
      intento,
      estado: 'ENVIADO',
      job_id: String(job.id),
      message_id: resultado.messageId
    };
  } catch (error) {
    // Antes de declarar ERROR verificamos el estado real del job.
    // Asi evitamos duplicados cuando waitUntilFinished expira
    // pero BullMQ todavia conserva el trabajo.
    if (job) {
      try {
        const estadoJob = await job.getState();

        // El job puede haber terminado correctamente aunque
        // QueueEvents no haya notificado antes del timeout.
        if (estadoJob === 'completed') {
          const jobActual =
            await emailQueue.getJob(String(job.id));

          const resultadoFinal =
            jobActual?.returnvalue;

          if (resultadoFinal?.messageId) {
            await marcarEnviado(
              envio.id_envio,
              idPago,
              resultadoFinal.messageId
            );

            console.warn(
              `[HU-13][RECUPERADO] pago=${idPago} ` +
              `intento=${intento} job=${job.id} ` +
              'el job termino aunque la espera expiro'
            );

            return {
              id_pago: idPago,
              id_envio: envio.id_envio,
              correo: comprobante.correo,
              comprobante: comprobante.numero,
              intento,
              estado: 'ENVIADO',
              job_id: String(job.id),
              message_id: resultadoFinal.messageId
            };
          }

          throw crearError(
            503,
            'El envio termino, pero no se pudo confirmar el messageId.'
          );
        }

        // Si todavia no esta siendo procesado, lo retiramos
        // antes de permitir un nuevo intento.
        if (
          estadoJob === 'waiting' ||
          estadoJob === 'delayed' ||
          estadoJob === 'prioritized'
        ) {
          await job.remove();

          console.warn(
            `[HU-13][JOB_REMOVED] pago=${idPago} ` +
            `intento=${intento} job=${job.id} ` +
            `estado=${estadoJob}`
          );
        } else if (estadoJob === 'failed') {
          // Ya fallo definitivamente en BullMQ.
          console.warn(
            `[HU-13][JOB_FAILED] pago=${idPago} ` +
            `intento=${intento} job=${job.id}`
          );
        } else {
          // ACTIVE, WAITING-CHILDREN o UNKNOWN:
          // no es seguro habilitar otro intento.
          console.warn(
            `[HU-13][ENVIO_SIN_CONFIRMAR] pago=${idPago} ` +
            `intento=${intento} job=${job.id} ` +
            `estado=${estadoJob}`
          );

          throw crearError(
            503,
            'El envio sigue en proceso o no se pudo confirmar su estado. No lo reintente todavia.'
          );
        }
      } catch (queueError) {
        if (queueError.status) {
          throw queueError;
        }

        console.error(
          `[HU-13][QUEUE_STATE_ERROR] pago=${idPago} ` +
          `job=${job.id} error=${queueError.message}`
        );

        // Si Redis/BullMQ no permite confirmar el estado,
        // dejamos el registro PENDIENTE. Asi otro intento
        // queda bloqueado y evitamos un posible correo duplicado.
        throw crearError(
          503,
          'No se pudo confirmar el estado del envio. No lo reintente todavia.'
        );
      }
    }

    // Solo llegamos aqui cuando sabemos que el intento ya
    // no puede generar un envio posterior inesperado.
    try {
      await marcarError(
        envio.id_envio,
        idPago,
        error.message
      );
    } catch (dbError) {
      console.error(
        `[HU-13][DB_ERROR] pago=${idPago} ` +
        `idEnvio=${envio.id_envio} ` +
        `error=${dbError.message}`
      );
    }

    console.error(
      `[HU-13][ENVIO_ERROR] pago=${idPago} ` +
      `intento=${intento} error=${error.message}`
    );

    throw crearError(
      502,
      intento < 3
        ? `No se pudo enviar el comprobante. Puede reintentarlo ${
            3 - intento
          } vez/veces mas.`
        : 'No se pudo enviar el comprobante y se alcanzo el maximo de reenvios.'
    );
  }
}

module.exports = {
  enviarComprobante
};