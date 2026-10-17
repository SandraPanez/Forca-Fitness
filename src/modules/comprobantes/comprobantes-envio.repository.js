const db = require('../../shared/config/database');

const SCHEMA = '"Academia Forca&Fitness"';

// Obtiene el ultimo intento de envio realizado para un pago.
async function obtenerUltimoEnvio(idPago) {
  const result = await db.query(`
    SELECT
      "Id_Envio" AS id_envio,
      "Id_Pago" AS id_pago,
      "Correo_Destino" AS correo_destino,
      "Numero_Comprobante" AS numero_comprobante,
      "Intento" AS intento,
      "Estado" AS estado,
      "Job_Id" AS job_id,
      "Trace_Id" AS trace_id,
      "Message_Id" AS message_id,
      "Error" AS error,
      "Fecha_Solicitud" AS fecha_solicitud,
      "Fecha_Resultado" AS fecha_resultado
    FROM ${SCHEMA}."Envio_Comprobante"
    WHERE "Id_Pago" = $1
    ORDER BY "Intento" DESC
    LIMIT 1
  `, [idPago]);

  return result.rows[0] || null;
}

// Registra una solicitud de envio antes de colocarla en BullMQ.
async function crearEnvioPendiente({
  idPago,
  correoDestino,
  numeroComprobante,
  intento,
  traceId
}) {
  const result = await db.query(`
    INSERT INTO ${SCHEMA}."Envio_Comprobante" (
      "Id_Pago",
      "Correo_Destino",
      "Numero_Comprobante",
      "Intento",
      "Estado",
      "Trace_Id"
    )
    VALUES ($1, $2, $3, $4, 'PENDIENTE', $5)
    RETURNING
      "Id_Envio" AS id_envio,
      "Id_Pago" AS id_pago,
      "Correo_Destino" AS correo_destino,
      "Numero_Comprobante" AS numero_comprobante,
      "Intento" AS intento,
      "Estado" AS estado,
      "Trace_Id" AS trace_id,
      "Fecha_Solicitud" AS fecha_solicitud
  `, [
    idPago,
    correoDestino,
    numeroComprobante,
    intento,
    traceId
  ]);

  return result.rows[0];
}

// Guarda el identificador que BullMQ asigna al trabajo.
async function asignarJob(idEnvio, jobId) {
  await db.query(`
    UPDATE ${SCHEMA}."Envio_Comprobante"
    SET "Job_Id" = $2
    WHERE "Id_Envio" = $1
  `, [idEnvio, String(jobId)]);
}

// Registra que el correo fue enviado correctamente.
async function marcarEnviado(idEnvio, messageId) {
  const result = await db.query(`
    UPDATE ${SCHEMA}."Envio_Comprobante"
    SET
      "Estado" = 'ENVIADO',
      "Message_Id" = $2,
      "Error" = NULL,
      "Fecha_Resultado" = CURRENT_TIMESTAMP
    WHERE "Id_Envio" = $1
    RETURNING *
  `, [idEnvio, messageId]);

  return result.rows[0] || null;
}

// Registra el error final despues de agotar los reintentos automaticos.
async function marcarError(idEnvio, mensajeError) {
  const result = await db.query(`
    UPDATE ${SCHEMA}."Envio_Comprobante"
    SET
      "Estado" = 'ERROR',
      "Error" = $2,
      "Fecha_Resultado" = CURRENT_TIMESTAMP
    WHERE "Id_Envio" = $1
    RETURNING *
  `, [idEnvio, mensajeError]);

  return result.rows[0] || null;
}

module.exports = {
  obtenerUltimoEnvio,
  crearEnvioPendiente,
  asignarJob,
  marcarEnviado,
  marcarError
};