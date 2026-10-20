const { randomBytes } = require('crypto');

const db = require('../../shared/config/database');

const SCHEMA = '"Academia Forca&Fitness"';

// La BD usa Id_envio VARCHAR(10), por eso lo generamos
// desde el backend con exactamente 10 caracteres.
function generarIdEnvio() {
  return randomBytes(5).toString('hex').toUpperCase();
}

function limitarTexto(valor, longitud) {
  if (valor === null || valor === undefined) {
    return null;
  }

  return String(valor).slice(0, longitud);
}

// Obtiene el ultimo intento de envio realizado para un pago.
async function obtenerUltimoEnvio(idPago) {
  const result = await db.query(`
    SELECT
      "Id_envio" AS id_envio,
      "Id_Pago" AS id_pago,
      "correo_destino" AS correo_destino,
      "intento" AS intento,
      "Estado_Envio" AS estado,
      "Job_id" AS job_id,
      "Trace_id" AS trace_id,
      "Message_id" AS message_id,
      "Mensaje_error" AS error,
      "Fecha_Solicitud" AS fecha_solicitud,
      "Fecha_Resultado" AS fecha_resultado
    FROM ${SCHEMA}."Envio_Comprobante"
    WHERE "Id_Pago" = $1
    ORDER BY "intento" DESC, "Fecha_Solicitud" DESC
    LIMIT 1
  `, [idPago]);

  return result.rows[0] || null;
}

// Registra el intento antes de colocarlo en BullMQ.
async function crearEnvioPendiente({
  idPago,
  correoDestino,
  intento,
  traceId
}) {
  const idEnvio = generarIdEnvio();

  const result = await db.query(`
    INSERT INTO ${SCHEMA}."Envio_Comprobante" (
      "Id_envio",
      "Id_Pago",
      "correo_destino",
      "intento",
      "Estado_Envio",
      "Trace_id",
      "Fecha_Solicitud"
    )
    VALUES ($1, $2, $3, $4, 'PENDIENTE', $5, CURRENT_TIMESTAMP)
    RETURNING
      "Id_envio" AS id_envio,
      "Id_Pago" AS id_pago,
      "correo_destino" AS correo_destino,
      "intento" AS intento,
      "Estado_Envio" AS estado,
      "Trace_id" AS trace_id,
      "Fecha_Solicitud" AS fecha_solicitud
  `, [
    idEnvio,
    idPago,
    correoDestino,
    intento,
    limitarTexto(traceId, 50)
  ]);

  return result.rows[0];
}

// Guarda el ID que BullMQ asigna al trabajo.
// Usamos Id_envio + Id_Pago porque esa es la PK real de la tabla.
async function asignarJob(idEnvio, idPago, jobId) {
  await db.query(`
    UPDATE ${SCHEMA}."Envio_Comprobante"
    SET "Job_id" = $3
    WHERE "Id_envio" = $1
      AND "Id_Pago" = $2
  `, [
    idEnvio,
    idPago,
    limitarTexto(jobId, 50)
  ]);
}

// Registra que SMTP termino correctamente.
async function marcarEnviado(idEnvio, idPago, messageId) {
  const result = await db.query(`
    UPDATE ${SCHEMA}."Envio_Comprobante"
    SET
      "Estado_Envio" = 'ENVIADO',
      "Message_id" = $3,
      "Mensaje_error" = NULL,
      "Fecha_Resultado" = CURRENT_TIMESTAMP
    WHERE "Id_envio" = $1
      AND "Id_Pago" = $2
    RETURNING *
  `, [
    idEnvio,
    idPago,
    limitarTexto(messageId, 100)
  ]);

  return result.rows[0] || null;
}

// Registra el error final del intento.
async function marcarError(idEnvio, idPago, mensajeError) {
  const result = await db.query(`
    UPDATE ${SCHEMA}."Envio_Comprobante"
    SET
      "Estado_Envio" = 'ERROR',
      "Mensaje_error" = $3,
      "Fecha_Resultado" = CURRENT_TIMESTAMP
    WHERE "Id_envio" = $1
      AND "Id_Pago" = $2
    RETURNING *
  `, [
    idEnvio,
    idPago,
    limitarTexto(mensajeError, 255)
  ]);

  return result.rows[0] || null;
}

module.exports = {
  obtenerUltimoEnvio,
  crearEnvioPendiente,
  asignarJob,
  marcarEnviado,
  marcarError
};