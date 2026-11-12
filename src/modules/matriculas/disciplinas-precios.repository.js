// HU-26: precio base y promoción de las disciplinas.
// Requiere hu26-precios-promociones-migration.sql.
const db = require('../../shared/config/database');

const SCHEMA = '"Academia Forca&Fitness"';

// Precio que paga una matrícula NUEVA: tarifa base menos la promoción activa.
// Mismo redondeo que calcularDescuento (public/js/descuentos.js): al céntimo, mitad hacia arriba.
function expresionPrecioVigente(alias = 'd') {
  return `(CASE ${alias}."Promocion_Tipo"
      WHEN 'PORCENTAJE' THEN ${alias}."Tarifa" - ROUND(${alias}."Tarifa" * ${alias}."Promocion_Valor" / 100, 2)
      WHEN 'MONTO_FIJO' THEN ${alias}."Tarifa" - ${alias}."Promocion_Valor"
      ELSE ${alias}."Tarifa"
    END)`;
}

// Precio de un detalle de matrícula: el congelado si la matrícula se registró
// antes de un cambio de precio; si no, el precio vigente.
function expresionPrecioDetalle(aliasDetalle = 'dm', aliasDisciplina = 'd') {
  return `COALESCE(${aliasDetalle}."Tarifa_Aplicada", ${expresionPrecioVigente(aliasDisciplina)})`;
}

const COLUMNAS_PRECIO = `
  d."Id_Disciplinas" AS id,
  d."Nombre_Disciplina" AS nombre,
  d."Descripcion" AS descripcion,
  d."Tarifa"::NUMERIC(10,2) AS tarifa,
  d."Promocion_Tipo" AS promocion_tipo,
  d."Promocion_Valor"::NUMERIC(10,2) AS promocion_valor,
  d."Promocion_Texto" AS promocion_texto,
  ${expresionPrecioVigente('d')}::NUMERIC(10,2) AS precio_vigente
`;

function mapearPrecio(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    tarifa: Number(fila.tarifa),
    precio_vigente: Number(fila.precio_vigente),
    promocion: fila.promocion_tipo
      ? { tipo: fila.promocion_tipo, valor: Number(fila.promocion_valor), texto: fila.promocion_texto }
      : null
  };
}

async function listarPreciosDisciplinas(client = db) {
  const result = await client.query(`
    SELECT ${COLUMNAS_PRECIO}
    FROM ${SCHEMA}."Disciplina" d
    ORDER BY d."Nombre_Disciplina" ASC
  `);
  return result.rows.map(mapearPrecio);
}

async function obtenerPrecioDisciplina(idDisciplina, client = db, { bloquear = false } = {}) {
  const result = await client.query(`
    SELECT ${COLUMNAS_PRECIO}
    FROM ${SCHEMA}."Disciplina" d
    WHERE d."Id_Disciplinas" = $1
    ${bloquear ? 'FOR UPDATE' : ''}
  `, [idDisciplina]);
  return mapearPrecio(result.rows[0]);
}

// Congela el precio vigente en los detalles de matrículas ya registradas de la
// disciplina que todavía no tienen pago aprobado (son las únicas que aún leen la
// tarifa al generar el cobro). Las pagadas conservan su Pago."Monto"; no se tocan.
async function congelarPrecioMatriculasRegistradas(idDisciplina, client = db) {
  const result = await client.query(`
    UPDATE ${SCHEMA}."Detalles_Matricula" dm
    SET "Tarifa_Aplicada" = ${expresionPrecioVigente('d')}
    FROM ${SCHEMA}."Disciplina_Horario" dh,
         ${SCHEMA}."Disciplina" d,
         ${SCHEMA}."Matricula" m
    WHERE dh."Id_DiscHorario" = dm."Id_DiscHorario"
      AND d."Id_Disciplinas" = dh."Id_Disciplina"
      AND m."Id_Matricula" = dm."Id_Matricula"
      AND d."Id_Disciplinas" = $1
      AND dm."Tarifa_Aplicada" IS NULL
      AND m."Estado_Matricula" <> 'Anulada'
      AND NOT EXISTS (
        SELECT 1 FROM ${SCHEMA}."Pago" p
        WHERE p."Id_Matricula" = dm."Id_Matricula"
          AND p."Estado_Pago" = 'APROBADO'
      )
  `, [idDisciplina]);
  return result.rowCount;
}

async function actualizarPrecioDisciplina(idDisciplina, { tarifa, promocion }, client = db) {
  const result = await client.query(`
    UPDATE ${SCHEMA}."Disciplina"
    SET "Tarifa" = $2,
        "Promocion_Tipo" = $3,
        "Promocion_Valor" = $4,
        "Promocion_Texto" = $5
    WHERE "Id_Disciplinas" = $1
  `, [
    idDisciplina,
    tarifa,
    promocion ? promocion.tipo : null,
    promocion ? promocion.valor : null,
    promocion ? promocion.texto : null
  ]);
  return result.rowCount;
}

module.exports = {
  expresionPrecioVigente,
  expresionPrecioDetalle,
  listarPreciosDisciplinas,
  obtenerPrecioDisciplina,
  congelarPrecioMatriculasRegistradas,
  actualizarPrecioDisciplina
};
