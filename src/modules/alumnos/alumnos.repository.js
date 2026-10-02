const db = require('../../shared/config/database');

class AlumnosRepository {
  async findAllAlumnos() {
    const query = `
      SELECT
        a."Id_alumno" AS id,
        a."Nombre" AS nombres,
        a."Apellido_Paterno" AS apellido_paterno,
        a."Apellido_Materno" AS apellido_materno,
        m."Fecha_Inscripcion" AS fecha_matricula,
        m."Estado_Matricula" AS estado
      FROM "Academia Forca&Fitness"."Alumno" a
      LEFT JOIN "Academia Forca&Fitness"."Matricula" m
        ON a."Id_alumno" = m."Id_alumno"
      ORDER BY a."Nombre" ASC
    `;

    const result = await db.query(query);
    return result.rows;
  }

  async findAlumnoById(id) {
    const query = `
      SELECT 
        e.id, e.numero_documento, e.nombres, e.apellido_paterno, e.apellido_materno,
        e.fecha_nacimiento, e.correo_electronico, e.numero_celular, e.direccion,
        m.fecha_matricula, m.estado as estado_matricula, m.observaciones_medicas,
        (
          SELECT string_agg(d.nombre, ', ')
          FROM matricula_disciplinas md
          JOIN disciplinas d ON md.disciplina_id = d.id
          WHERE md.matricula_id = m.id
        ) as disciplinas
      FROM estudiantes e
      JOIN matriculas m ON e.id = m.estudiante_id
      WHERE e.id = $1
    `;
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }
}

module.exports = new AlumnosRepository();
