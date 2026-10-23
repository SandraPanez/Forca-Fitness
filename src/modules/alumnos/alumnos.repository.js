
const db = require("../../shared/config/database");

class AlumnosRepository {
  async findAllAlumnos(idProfesor = null) {
    const query = `
      SELECT DISTINCT ON (a."Id_alumno")
        a."Id_alumno" AS id,
        p."Nombre" AS nombres,
        p."Apellido_Paterno" AS apellido_paterno,
        p."Apellido_Materno" AS apellido_materno,

        m."Fecha_Inscripcion" AS fecha_matricula,
        TO_CHAR(dm."Fecha_Fin", 'YYYY-MM-DD') AS fecha_fin,
        m."Estado_Matricula" AS estado,

        ARRAY(
          SELECT DISTINCT d."Nombre_Disciplina"
          FROM "Academia Forca&Fitness"."Detalles_Matricula" dm_alumno
          JOIN "Academia Forca&Fitness"."Disciplina_Horario" dh_alumno
            ON dm_alumno."Id_DiscHorario" = dh_alumno."Id_DiscHorario"
          JOIN "Academia Forca&Fitness"."Disciplina" d
            ON dh_alumno."Id_Disciplina" = d."Id_Disciplinas"
          WHERE dm_alumno."Id_Matricula" = m."Id_Matricula"
            ${idProfesor !== null
              ? 'AND dh_alumno."Id_Profesor" = $1'
              : ''}
          ORDER BY d."Nombre_Disciplina"
        ) AS disciplinas

      FROM "Academia Forca&Fitness"."Alumno" a

      JOIN "Academia Forca&Fitness"."Persona" p
        ON p."Id_Persona" = a."Id_Persona"

      JOIN "Academia Forca&Fitness"."Matricula" m
        ON a."Id_alumno" = m."Id_alumno"

      JOIN "Academia Forca&Fitness"."Detalles_Matricula" dm
        ON dm."Id_Matricula" = m."Id_Matricula"

      JOIN "Academia Forca&Fitness"."Disciplina_Horario" dh
        ON dm."Id_DiscHorario" = dh."Id_DiscHorario"

      ${idProfesor !== null
        ? 'WHERE dh."Id_Profesor" = $1'
        : ''}

      ORDER BY
        a."Id_alumno",

        CASE
          WHEN UPPER(TRIM(m."Estado_Matricula")) IN ('ACTIVA', 'ACTIVO')
               AND dm."Fecha_Fin" >= CURRENT_DATE
          THEN 0
          ELSE 1
        END,

        CASE
          WHEN UPPER(TRIM(m."Estado_Matricula")) IN ('ACTIVA', 'ACTIVO')
               AND dm."Fecha_Fin" >= CURRENT_DATE
          THEN dm."Fecha_Fin"
        END ASC NULLS LAST,

        dm."Fecha_Fin" DESC NULLS LAST,
        m."Fecha_Inscripcion" DESC NULLS LAST,
        m."Id_Matricula" DESC,
        dm."Id_DetMatricula" DESC
    `;

    const values = idProfesor !== null ? [idProfesor] : [];

    const result = await db.query(query, values);

    return result.rows;
  }

  async findAlumnoById(id, idProfesor = null) {
    const query = `
      SELECT
        a."Id_alumno" AS id,

        p."Numero_Documento" AS numero_documento,
        p."Nombre" AS nombres,
        p."Apellido_Paterno" AS apellido_paterno,
        p."Apellido_Materno" AS apellido_materno,
        p."Fecha_Nacimiento" AS fecha_nacimiento,
        p."Direccion" AS direccion,

        a."Condicion" AS observaciones_medicas,

        m."Fecha_Inscripcion" AS fecha_matricula,
        TO_CHAR(dm_seleccionado."Fecha_Fin", 'YYYY-MM-DD') AS fecha_fin,
        m."Estado_Matricula" AS estado_matricula,

        (
          SELECT string_agg(d."Nombre_Disciplina", ', ')
          FROM "Academia Forca&Fitness"."Detalles_Matricula" dm
          JOIN "Academia Forca&Fitness"."Disciplina_Horario" dh
            ON dm."Id_DiscHorario" = dh."Id_DiscHorario"
          JOIN "Academia Forca&Fitness"."Disciplina" d
            ON dh."Id_Disciplina" = d."Id_Disciplinas"
          WHERE dm."Id_Matricula" = m."Id_Matricula"
            AND (
              $2::VARCHAR IS NULL
              OR dh."Id_Profesor" = $2
            )
        ) AS disciplinas,

        (
          SELECT mc."Contacto"
          FROM "Academia Forca&Fitness"."Metodo_Contacto" mc
          WHERE mc."Id_Persona" = a."Id_Persona"
            AND mc."Tipo_Contacto" = 'CORREO'
          LIMIT 1
        ) AS correo_electronico,

        (
          SELECT mc."Contacto"
          FROM "Academia Forca&Fitness"."Metodo_Contacto" mc
          WHERE mc."Id_Persona" = a."Id_Persona"
            AND mc."Tipo_Contacto" = 'CELULAR'
          LIMIT 1
        ) AS numero_celular

      FROM "Academia Forca&Fitness"."Alumno" a

      JOIN "Academia Forca&Fitness"."Persona" p
        ON p."Id_Persona" = a."Id_Persona"

      JOIN "Academia Forca&Fitness"."Matricula" m
        ON a."Id_alumno" = m."Id_alumno"

      JOIN "Academia Forca&Fitness"."Detalles_Matricula" dm_seleccionado
        ON dm_seleccionado."Id_Matricula" = m."Id_Matricula"

      JOIN "Academia Forca&Fitness"."Disciplina_Horario" dh_seleccionado
        ON dm_seleccionado."Id_DiscHorario" = dh_seleccionado."Id_DiscHorario"

      WHERE a."Id_alumno" = $1
        AND (
          $2::VARCHAR IS NULL
          OR dh_seleccionado."Id_Profesor" = $2
        )

      ORDER BY
        CASE
          WHEN UPPER(TRIM(m."Estado_Matricula")) IN ('ACTIVA', 'ACTIVO')
               AND dm_seleccionado."Fecha_Fin" >= CURRENT_DATE
          THEN 0
          ELSE 1
        END,

        CASE
          WHEN UPPER(TRIM(m."Estado_Matricula")) IN ('ACTIVA', 'ACTIVO')
               AND dm_seleccionado."Fecha_Fin" >= CURRENT_DATE
          THEN dm_seleccionado."Fecha_Fin"
        END ASC NULLS LAST,

        dm_seleccionado."Fecha_Fin" DESC NULLS LAST,
        m."Fecha_Inscripcion" DESC NULLS LAST,
        m."Id_Matricula" DESC,
        dm_seleccionado."Id_DetMatricula" DESC

      LIMIT 1
    `;

    const result = await db.query(query, [id, idProfesor]);

    return result.rows[0] || null;
  }
}

module.exports = new AlumnosRepository();
