const db = require("../../shared/config/database");

class AlumnosRepository {
  async findAllAlumnos() {
    const query = `
      SELECT DISTINCT ON (a."Id_alumno")
        a."Id_alumno" AS id,
        p."Nombre" AS nombres,
        p."Apellido_Paterno" AS apellido_paterno,
        p."Apellido_Materno" AS apellido_materno,
        a."Estado_Alumno" AS estado_alumno,
        a."Condicion" AS observaciones_medicas,
        m."Fecha_Inscripcion" AS fecha_matricula,
        m."Estado_Matricula" AS estado
      FROM "Academia Forca&Fitness"."Alumno" a
      JOIN "Academia Forca&Fitness"."Persona" p ON p."Id_Persona" = a."Id_Persona"
      LEFT JOIN "Academia Forca&Fitness"."Matricula" m ON a."Id_alumno" = m."Id_alumno"
      ORDER BY a."Id_alumno", m."Fecha_Inscripcion" DESC NULLS LAST, p."Nombre" ASC
    `;
    const result = await db.query(query);
    return result.rows;
  }

  async findAlumnoById(id) {
    const query = `
      SELECT 
        a."Id_alumno" AS id,
        a."Id_Persona" AS id_persona,
        a."Estado_Alumno" AS estado_alumno_db,
        p."Numero_Documento" AS numero_documento,
        p."Nombre" AS nombres,
        p."Apellido_Paterno" AS apellido_paterno,
        p."Apellido_Materno" AS apellido_materno,
        p."Fecha_Nacimiento" AS fecha_nacimiento,
        p."Direccion" AS direccion,
        a."Condicion" AS observaciones_medicas,
        m."Id_Matricula" AS id_matricula,
        m."Fecha_Inscripcion" AS fecha_matricula,
        m."Estado_Matricula" AS estado_matricula,
        (
          SELECT string_agg(d."Nombre_Disciplina", ', ')
          FROM "Academia Forca&Fitness"."Detalles_Matricula" dm
          JOIN "Academia Forca&Fitness"."Disciplina_Horario" dh ON dm."Id_DiscHorario" = dh."Id_DiscHorario"
          JOIN "Academia Forca&Fitness"."Disciplina" d ON dh."Id_Disciplina" = d."Id_Disciplinas"
          WHERE dm."Id_Matricula" = m."Id_Matricula"
        ) AS disciplinas,
        (
          SELECT mc."Contacto" 
          FROM "Academia Forca&Fitness"."Metodo_Contacto" mc
          WHERE mc."Id_Persona" = a."Id_Persona" AND mc."Tipo_Contacto" = 'CORREO'
          LIMIT 1
        ) AS correo_electronico,
        (
          SELECT mc."Contacto" 
          FROM "Academia Forca&Fitness"."Metodo_Contacto" mc
          WHERE mc."Id_Persona" = a."Id_Persona" AND mc."Tipo_Contacto" = 'CELULAR'
          LIMIT 1
        ) AS numero_celular
      FROM "Academia Forca&Fitness"."Alumno" a
      JOIN "Academia Forca&Fitness"."Persona" p ON p."Id_Persona" = a."Id_Persona"
      LEFT JOIN "Academia Forca&Fitness"."Matricula" m ON a."Id_alumno" = m."Id_alumno"
      WHERE a."Id_alumno" = $1
      ORDER BY m."Fecha_Inscripcion" DESC NULLS LAST
      LIMIT 1
    `;
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  async inhabilitarAlumno(id, nuevaCondicion) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const alumnoRes = await client.query(
        `SELECT "Id_alumno", "Id_Persona", "Estado_Alumno", "Condicion"
         FROM "Academia Forca&Fitness"."Alumno"
         WHERE "Id_alumno" = $1
         FOR UPDATE`,
        [id]
      );

      if (alumnoRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const alumno = alumnoRes.rows[0];

      // Actualizar estado del alumno a Inhabilitado conservando datos personales y matrículas intactos
      const updateAlumnoRes = await client.query(
        `UPDATE "Academia Forca&Fitness"."Alumno"
         SET "Estado_Alumno" = 'Inhabilitado',
             "Condicion" = $2
         WHERE "Id_alumno" = $1
         RETURNING "Id_alumno" AS id, "Estado_Alumno" AS estado_alumno, "Condicion" AS condicion`,
        [id, nuevaCondicion]
      );

      // Suspender acceso temporalmente en Usuario asociado sin eliminar su cuenta ni sus roles
      if (alumno.Id_Persona) {
        await client.query(
          `UPDATE "Academia Forca&Fitness"."Usuario"
           SET "Estado_Usuario" = 'Inactivo'
           WHERE "Id_Persona" = $1`,
          [alumno.Id_Persona]
        );
      }

      await client.query('COMMIT');
      return updateAlumnoRes.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = new AlumnosRepository();