const db = require('../../shared/config/database');

const SCHEMA = '"Academia Forca&Fitness"';

// Estados con los que el sistema considera una matrícula aprobada y en curso
// (mismos que usan HU-17 y la renovación en matriculas.service/repository).
const ESTADOS_MATRICULA_VIGENTE = ['ACTIVA', 'ACTIVO', 'RESERVADA'];

class RecordatoriosVencimientoRepository {

  // =========================================================
  // HU-20 T2/T3 - Matrículas que vencen exactamente en N días
  // =========================================================
  // fechaReferencia: 'YYYY-MM-DD' (día calendario en America/Lima).
  // diasAntes: enteros exactos, p. ej. [3, 1]. La resta DATE - DATE de
  // PostgreSQL devuelve días enteros, sin horas ni zona horaria.
  async obtenerMatriculasPorVencer(fechaReferencia, diasAntes, client = db) {
    const query = `
      SELECT
        m."Id_Matricula" AS id_matricula,
        dm."Id_DetMatricula" AS id_detalle,
        m."Estado_Matricula" AS estado_matricula,
        a."Id_alumno" AS id_alumno,
        TRIM(CONCAT_WS(' ', pe."Nombre", pe."Apellido_Paterno")) AS nombre_alumno,
        COALESCE(NULLIF(TRIM(u."Correo"), ''), contacto.correo) AS correo,
        d."Id_Disciplinas" AS id_disciplina,
        d."Nombre_Disciplina" AS disciplina,
        TO_CHAR(dm."Fecha_Fin", 'YYYY-MM-DD') AS fecha_fin,
        (dm."Fecha_Fin" - $1::DATE) AS dias_restantes
      FROM ${SCHEMA}."Matricula" m
      JOIN ${SCHEMA}."Alumno" a ON a."Id_alumno" = m."Id_alumno"
      JOIN ${SCHEMA}."Persona" pe ON pe."Id_Persona" = a."Id_Persona"
      JOIN ${SCHEMA}."Detalles_Matricula" dm ON dm."Id_Matricula" = m."Id_Matricula"
      JOIN ${SCHEMA}."Disciplina_Horario" dh ON dh."Id_DiscHorario" = dm."Id_DiscHorario"
      JOIN ${SCHEMA}."Disciplina" d ON d."Id_Disciplinas" = dh."Id_Disciplina"
      LEFT JOIN ${SCHEMA}."Usuario" u ON u."Id_Persona" = a."Id_Persona"
      LEFT JOIN LATERAL (
        SELECT TRIM(mc."Contacto") AS correo
        FROM ${SCHEMA}."Metodo_Contacto" mc
        WHERE mc."Id_Persona" = a."Id_Persona"
          AND UPPER(mc."Tipo_Contacto") = 'CORREO'
          AND TRIM(mc."Contacto") <> ''
        ORDER BY mc."Id_contacto"
        LIMIT 1
      ) contacto ON TRUE
      WHERE UPPER(m."Estado_Matricula") = ANY($3::TEXT[])
        AND dm."Fecha_Inicio" <= $1::DATE
        AND (dm."Fecha_Fin" - $1::DATE) = ANY($2::INT[])
      ORDER BY dm."Fecha_Fin" ASC, a."Id_alumno" ASC, d."Nombre_Disciplina" ASC
    `;

    const result = await client.query(query, [
      fechaReferencia,
      diasAntes,
      ESTADOS_MATRICULA_VIGENTE
    ]);
    return result.rows;
  }

  // =========================================================
  // HU-20 T4 - ¿Ya existe el siguiente periodo confirmado?
  // =========================================================
  // Siguiente periodo = otro detalle del mismo alumno y disciplina que
  // empieza después del vencimiento actual. Está confirmado si:
  //  - la matrícula quedó 'Reservada' (pago aprobado de periodo futuro), o
  //  - tiene un pago 'APROBADO' (pago anticipado).
  // Las renovaciones solo PENDIENTES no excluyen el recordatorio.
  async obtenerSiguientePeriodoConfirmado({ idAlumno, idDisciplina, fechaFin }, client = db) {
    const query = `
      SELECT
        COALESCE(BOOL_OR(UPPER(m."Estado_Matricula") = 'RESERVADA'), FALSE) AS tiene_reserva,
        COALESCE(BOOL_OR(EXISTS (
          SELECT 1
          FROM ${SCHEMA}."Pago" p
          WHERE p."Id_Matricula" = m."Id_Matricula"
            AND UPPER(p."Estado_Pago") = 'APROBADO'
        )), FALSE) AS tiene_pago_anticipado
      FROM ${SCHEMA}."Matricula" m
      JOIN ${SCHEMA}."Detalles_Matricula" dm ON dm."Id_Matricula" = m."Id_Matricula"
      JOIN ${SCHEMA}."Disciplina_Horario" dh ON dh."Id_DiscHorario" = dm."Id_DiscHorario"
      WHERE m."Id_alumno" = $1
        AND dh."Id_Disciplina" = $2
        AND dm."Fecha_Inicio" > $3::DATE
        AND UPPER(m."Estado_Matricula") <> 'ANULADA'
    `;

    const result = await client.query(query, [idAlumno, idDisciplina, fechaFin]);
    const fila = result.rows[0] || {};
    return {
      tiene_reserva: fila.tiene_reserva === true,
      tiene_pago_anticipado: fila.tiene_pago_anticipado === true
    };
  }
}

module.exports = new RecordatoriosVencimientoRepository();
