const db = require('../../shared/config/database');

const SCHEMA = '"Academia Forca&Fitness"';

class HorariosRepository {

  async listarClases(cliente = db) {
    const query = `
      SELECT
        dh."Id_DiscHorario" AS id_disc_horario,
        dh."Id_Horario" AS id_horario,
        dh."Id_Disciplina" AS id_disciplina,
        dh."Id_Profesor" AS id_profesor,

        d."Nombre_Disciplina" AS disciplina,

        h."Dias" AS dias,
        h."Hora_Inicio" AS hora_inicio,
        h."Hora_Fin" AS hora_fin,
        h."Turno" AS turno,

        dh."Capacidad_Max" AS capacidad_max,

        pp."Nombre" || ' ' ||
        pp."Apellido_Paterno" AS profesor_nombre

      FROM ${SCHEMA}."Disciplina_Horario" dh

      JOIN ${SCHEMA}."Horarios" h
        ON dh."Id_Horario" = h."Id_Horario"

      JOIN ${SCHEMA}."Disciplina" d
        ON dh."Id_Disciplina" = d."Id_Disciplinas"

      LEFT JOIN ${SCHEMA}."Profesor" p
        ON dh."Id_Profesor" = p."Id_Profesor"

      LEFT JOIN ${SCHEMA}."Persona" pp
        ON p."Id_Persona" = pp."Id_Persona"

      ORDER BY
        d."Nombre_Disciplina",
        h."Hora_Inicio"
    `;

    const result = await cliente.query(query);
    return result.rows;
  }

  async contarAlumnosActivos(idDiscHorario, cliente = db) {
    const query = `
        SELECT COUNT(DISTINCT m."Id_alumno") AS total
        FROM ${SCHEMA}."Detalles_Matricula" dm
        JOIN ${SCHEMA}."Matricula" m
        ON m."Id_Matricula" = dm."Id_Matricula"
        WHERE dm."Id_DiscHorario" = $1
        AND dm."Fecha_Fin" >= CURRENT_DATE
        AND UPPER(TRIM(m."Estado_Matricula"))
            IN ('ACTIVA', 'ACTIVO')
    `;

    const result = await cliente.query(query, [idDiscHorario]);

    return Number(result.rows[0]?.total || 0);
  }

  async ejecutarEnTransaccion(operacion) {
    const cliente = await db.pool.connect();

    try {
        await cliente.query(
        'BEGIN ISOLATION LEVEL SERIALIZABLE'
        );

        const resultado = await operacion(cliente);

        await cliente.query('COMMIT');

        return resultado;

    } catch (error) {
        await cliente.query('ROLLBACK');
        throw error;

    } finally {
        cliente.release();
    }
  }

  async actualizarHorarioExclusivo(idDiscHorario, propuesta, cliente) {

    if (!cliente) {
        throw new Error('Se requiere una transaccion activa.');
    }

    // Buscar la clase y bloquear su registro durante el cambio.
    const claseResult = await cliente.query(`
        SELECT "Id_Horario" AS id_horario
        FROM ${SCHEMA}."Disciplina_Horario"
        WHERE "Id_DiscHorario" = $1
        FOR UPDATE
    `, [idDiscHorario]);

    if (claseResult.rows.length === 0) {
        throw new Error('La clase seleccionada no existe.');
    }

    const idHorario = claseResult.rows[0].id_horario;

    // Bloquear el horario mientras se procesa la actualizacion.
    const horarioResult = await cliente.query(`
        SELECT "Id_Horario"
        FROM ${SCHEMA}."Horarios"
        WHERE "Id_Horario" = $1
        FOR UPDATE
    `, [idHorario]);

    if (horarioResult.rows.length === 0) {
        throw new Error('El horario asociado no existe.');
    }

    // Evitar modificar accidentalmente otras clases.
    const usoResult = await cliente.query(`
        SELECT COUNT(*)::integer AS cantidad
        FROM ${SCHEMA}."Disciplina_Horario"
        WHERE "Id_Horario" = $1
    `, [idHorario]);

    if (usoResult.rows[0].cantidad !== 1) {
        throw new Error(
            'Este horario es compartido por varias clases y no puede modificarse directamente.'
        );
    }

    // Actualizar los datos del horario.
    const resultado = await cliente.query(`
        UPDATE ${SCHEMA}."Horarios"
        SET
        "Dias" = $2,
        "Hora_Inicio" = $3,
        "Hora_Fin" = $4,
        "Turno" = $5
        WHERE "Id_Horario" = $1
        RETURNING
        "Id_Horario" AS id_horario,
        "Dias" AS dias,
        "Hora_Inicio" AS hora_inicio,
        "Hora_Fin" AS hora_fin,
        "Turno" AS turno
    `, [
        idHorario,
        propuesta.dias,
        propuesta.hora_inicio,
        propuesta.hora_fin,
        propuesta.turno
    ]);

    if (resultado.rowCount !== 1) {
        throw new Error('No se pudo actualizar el horario.');
    }

    return resultado.rows[0];
  }

}

module.exports = new HorariosRepository();