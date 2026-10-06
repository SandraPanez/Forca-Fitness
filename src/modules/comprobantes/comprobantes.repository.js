const db = require('../../shared/config/database');

const SCHEMA = '"Academia Forca&Fitness"';

// Pago del que se genera el comprobante.
// La fecha de emisión es la del cobro aprobado en Registro_Cobro, que no se
// puede editar ni borrar; por eso el comprobante siempre sale igual.
async function buscarPorPago(idPago) {
  // ponytail: el correlativo se calcula contando los cobros aprobados del año;
  // si se crea una tabla de comprobantes, leer el número de ahí.
  const result = await db.query(`
    SELECT
      p."Id_Pago" AS id_pago,
      p."Estado_Pago" AS estado_pago,
      COALESCE(cobro."Fecha_Hora", p."Fecha_Pago") AS fecha_emision,
      TRIM(per."Nombre" || ' ' || COALESCE(per."Segundo_Nombre" || ' ', '') ||
        per."Apellido_Paterno" || ' ' || per."Apellido_Materno") AS alumno,
      per."Numero_Documento" AS documento,
      det.disciplinas,
      (
        SELECT COUNT(DISTINCT rc."Id_Pago")
        FROM ${SCHEMA}."Registro_Cobro" rc
        WHERE rc."Resultado" = 'APROBADO'
          AND rc."Fecha_Hora" <= cobro."Fecha_Hora"
          AND DATE_TRUNC('year', rc."Fecha_Hora") = DATE_TRUNC('year', cobro."Fecha_Hora")
      )::int AS correlativo
    FROM ${SCHEMA}."Pago" p
    JOIN ${SCHEMA}."Matricula" m ON m."Id_Matricula" = p."Id_Matricula"
    JOIN ${SCHEMA}."Alumno" a ON a."Id_alumno" = m."Id_alumno"
    JOIN ${SCHEMA}."Persona" per ON per."Id_Persona" = a."Id_Persona"
    LEFT JOIN LATERAL (
      SELECT rc."Fecha_Hora"
      FROM ${SCHEMA}."Registro_Cobro" rc
      WHERE rc."Id_Pago" = p."Id_Pago"
        AND rc."Resultado" = 'APROBADO'
      ORDER BY rc."Fecha_Hora"
      LIMIT 1
    ) cobro ON TRUE
    LEFT JOIN LATERAL (
      SELECT STRING_AGG(DISTINCT d."Nombre_Disciplina", ', ' ORDER BY d."Nombre_Disciplina") AS disciplinas
      FROM ${SCHEMA}."Detalles_Matricula" dm
      JOIN ${SCHEMA}."Disciplina_Horario" dh ON dh."Id_DiscHorario" = dm."Id_DiscHorario"
      JOIN ${SCHEMA}."Disciplina" d ON d."Id_Disciplinas" = dh."Id_Disciplina"
      WHERE dm."Id_Matricula" = m."Id_Matricula"
    ) det ON TRUE
    WHERE p."Id_Pago" = $1
  `, [idPago]);

  return result.rows[0] || null;
}

module.exports = {
  buscarPorPago
};
