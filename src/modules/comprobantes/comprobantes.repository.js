const db = require('../../shared/config/database');

const SCHEMA = '"Academia Forca&Fitness"';

// Pago del que se genera el comprobante
async function buscarPorPago(idPago) {
  const result = await db.query(`
    SELECT
      p."Id_Pago" AS id_pago,
      p."Estado_Pago" AS estado_pago
    FROM ${SCHEMA}."Pago" p
    WHERE p."Id_Pago" = $1
  `, [idPago]);

  return result.rows[0] || null;
}

module.exports = {
  buscarPorPago
};
