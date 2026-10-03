const db = require("../../shared/config/database");

class AlumnosRepository {
  async findAllAlumnos() {
    const query = `
      SELECT DISTINCT ON (a."Id_alumno")
        a."Id_alumno" AS id,
        a."Nombre" AS nombres,
        a."Apellido_Paterno" AS apellido_paterno,
        a."Apellido_Materno" AS apellido_materno,
        m."Fecha_Inscripcion" AS fecha_matricula,
        m."Estado_Matricula" AS estado
      FROM "Academia Forca&Fitness"."Alumno" a
      JOIN "Academia Forca&Fitness"."Matricula" m ON a."Id_alumno" = m."Id_alumno"
      ORDER BY a."Id_alumno", a."Nombre" ASC
    `;
    const result = await db.query(query);
    return result.rows;
  }

  async findAlumnoById(id) {
    const query = `
      SELECT 
        a."Id_alumno" AS id,
        a."Numero_Documento" AS numero_documento,
        a."Nombre" AS nombres,
        a."Apellido_Paterno" AS apellido_paterno,
        a."Apellido_Materno" AS apellido_materno,
        a."Fecha_Nacimiento" AS fecha_nacimiento,
        a."Direccion" AS direccion,
        m."Fecha_Inscripcion" AS fecha_matricula,
        m."Estado_Matricula" AS estado_matricula,
        (
          SELECT string_agg(d."Nombre_Disciplina", ', ')
          FROM "Academia Forca&Fitness"."Detalles_Matricula" dm
          JOIN "Academia Forca&Fitness"."Disciplina_Horario" dh ON dm."Id_disc_horario" = dh."Id_disc_horario"
          JOIN "Academia Forca&Fitness"."Disciplina" d ON dh."Id_disciplina" = d."Id_disciplina"
          WHERE dm."Id_Matricula" = m."Id_Matricula"
        ) AS disciplinas,
        (
          SELECT mc."Contacto" 
          FROM "Academia Forca&Fitness"."Metodo_Contacto" mc
          WHERE mc."Id_alumno" = a."Id_alumno" AND mc."Tipo_Contacto" = 'correo'
          LIMIT 1
        ) AS correo_electronico,
        (
          SELECT mc."Contacto" 
          FROM "Academia Forca&Fitness"."Metodo_Contacto" mc
          WHERE mc."Id_alumno" = a."Id_alumno" AND mc."Tipo_Contacto" = 'celular'
          LIMIT 1
        ) AS numero_celular
      FROM "Academia Forca&Fitness"."Alumno" a
      JOIN "Academia Forca&Fitness"."Matricula" m ON a."Id_alumno" = m."Id_alumno"
      WHERE a."Id_alumno" = $1
    `;
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }
}

module.exports = new AlumnosRepository();
