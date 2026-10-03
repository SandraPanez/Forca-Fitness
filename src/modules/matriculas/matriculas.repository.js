const db = require('../../shared/config/database');

class MatriculasRepository {
  async getDisciplinas() {
    const query = `
      SELECT 
        "Id_Disciplinas" AS id, 
        "Nombre_Disciplina" AS nombre, 
        "Descripcion" AS descripcion 
      FROM "Academia Forca&Fitness"."Disciplina" 
      ORDER BY "Nombre_Disciplina" ASC
    `;
    const result = await db.query(query);
    return result.rows;
  }

  async findEstudianteByDocumento(tipo_documento, numero_documento) {
    const docQuery = `SELECT "Id_Documento" FROM "Academia Forca&Fitness"."Documento_Identificacion" WHERE "Tipo_Documento" = $1 LIMIT 1`;
    const docResult = await db.query(docQuery, [tipo_documento]);
    const id_doc = docResult.rows.length > 0 ? docResult.rows[0].Id_Documento : 'DOC01'; 

    const query = `
      SELECT "Id_alumno" as id FROM "Academia Forca&Fitness"."Alumno" 
      WHERE "Id_Documento" = $1 AND "Numero_Documento" = $2
    `;
    const result = await db.query(query, [id_doc, numero_documento]);
    return result.rows[0] || null;
  }

  generateId(prefix) {
    return prefix + Math.floor(100000 + Math.random() * 900000).toString();
  }

  async createEstudiante(data, client = db) {
    const docQuery = `SELECT "Id_Documento" FROM "Academia Forca&Fitness"."Documento_Identificacion" WHERE "Tipo_Documento" = $1 LIMIT 1`;
    const docResult = await client.query(docQuery, [data.tipo_documento]);
    const id_doc = docResult.rows.length > 0 ? docResult.rows[0].Id_Documento : 'DOC01'; 

    const id_alumno = this.generateId('ALU');
    const id_usuario = this.generateId('USR');

    const query = `
      INSERT INTO "Academia Forca&Fitness"."Alumno" (
        "Id_alumno", "Nombre", "Apellido_Paterno", "Apellido_Materno",
        "Fecha_Nacimiento", "Genero", "Direccion", "Estado_Alumno", 
        "Id_Documento", "Numero_Documento"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVO', $8, $9)
    `;
    const values = [
      id_alumno, data.nombres, data.apellido_paterno, data.apellido_materno,
      data.fecha_nacimiento, data.genero || 'OTRO', data.direccion || 'Sin direccion',
      id_doc, data.numero_documento
    ];
    await client.query(query, values);

    if (data.correo_electronico) {
      await client.query(`INSERT INTO "Academia Forca&Fitness"."Metodo_Contacto" ("Id_contacto", "Tipo_Contacto", "Contacto", "Id_alumno") VALUES ($1, 'CORREO', $2, $3)`, [this.generateId('CON'), data.correo_electronico, id_alumno]);
    }
    if (data.numero_celular) {
      await client.query(`INSERT INTO "Academia Forca&Fitness"."Metodo_Contacto" ("Id_contacto", "Tipo_Contacto", "Contacto", "Id_alumno") VALUES ($1, 'CELULAR', $2, $3)`, [this.generateId('CON'), data.numero_celular, id_alumno]);
    }

    const userQuery = `
      INSERT INTO "Academia Forca&Fitness"."Usuario" (
        "Id_Usuario", "Correo", "Password_Hash", "Estado_Usuario", "Id_Rol", "Id_alumno"
      ) VALUES ($1, $2, $3, 'ACTIVO', 'ROL04', $4)
    `;
    await client.query(userQuery, [id_usuario, data.correo_electronico, data.password_hash, id_alumno]);

    return id_alumno;
  }

  async updateEstudiante(id, data, client = db) {
    const query = `
      UPDATE "Academia Forca&Fitness"."Alumno"
      SET "Nombre" = $1, "Apellido_Paterno" = $2, "Apellido_Materno" = $3,
          "Fecha_Nacimiento" = $4, "Genero" = $5, "Direccion" = $6
      WHERE "Id_alumno" = $7
    `;
    await client.query(query, [data.nombres, data.apellido_paterno, data.apellido_materno, data.fecha_nacimiento, data.genero, data.direccion, id]);
    
    // Update Usuario
    await client.query(`UPDATE "Academia Forca&Fitness"."Usuario" SET "Correo" = $1, "Password_Hash" = $2 WHERE "Id_alumno" = $3`, [data.correo_electronico, data.password_hash, id]);
  }

  async createMatricula(estudiante_id, observaciones_medicas, client = db) {
    const id_matricula = this.generateId('MAT');
    const query = `
      INSERT INTO "Academia Forca&Fitness"."Matricula" ("Id_Matricula", "Fecha_Inscripcion", "Estado_Matricula", "Id_alumno")
      VALUES ($1, CURRENT_DATE, 'PENDIENTE', $2)
    `;
    await client.query(query, [id_matricula, estudiante_id]);
    return id_matricula;
  }

  async addDisciplinasAMatricula(matricula_id, disciplinasIds, client = db) {
    for (const disciplina_id of disciplinasIds) {
      const id_det_matricula = this.generateId('DET');
      
      const hor = await client.query(`SELECT "Id_DiscHorario" FROM "Academia Forca&Fitness"."Disciplina_Horario" WHERE "Id_Disciplina" = $1 LIMIT 1`, [disciplina_id]);
      
      if (hor.rows.length > 0) {
         await client.query(`
          INSERT INTO "Academia Forca&Fitness"."Detalles_Matricula" ("Id_DetMatricula", "Id_Matricula", "Fecha_Inicio", "Fecha_Fin", "Id_DiscHorario")
          VALUES ($1, $2, CURRENT_DATE, CURRENT_DATE + interval '30 days', $3)
         `, [id_det_matricula, matricula_id, hor.rows[0].Id_DiscHorario]);
      }
    }
  }
}

module.exports = new MatriculasRepository();
