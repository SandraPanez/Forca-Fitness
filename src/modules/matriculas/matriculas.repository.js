const db = require('../../shared/config/database');

class MatriculasRepository {
  async getDisciplinas() {
    const result = await db.query('SELECT id, nombre, descripcion FROM disciplinas ORDER BY id ASC');
    return result.rows;
  }

  async findEstudianteByDocumento(tipo_documento, numero_documento) {
    const query = `
      SELECT id FROM estudiantes 
      WHERE tipo_documento = $1 AND numero_documento = $2
    `;
    const result = await db.query(query, [tipo_documento, numero_documento]);
    return result.rows[0] || null;
  }

  async createEstudiante(data, client = db) {
    const query = `
      INSERT INTO estudiantes (
        tipo_documento, numero_documento, nombres, apellido_paterno, apellido_materno,
        fecha_nacimiento, correo_electronico, numero_celular, genero, direccion
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `;
    const values = [
      data.tipo_documento, data.numero_documento, data.nombres, data.apellido_paterno, data.apellido_materno,
      data.fecha_nacimiento, data.correo_electronico, data.numero_celular, data.genero, data.direccion
    ];
    const result = await client.query(query, values);
    return result.rows[0].id;
  }

  async updateEstudiante(id, data, client = db) {
    const query = `
      UPDATE estudiantes
      SET nombres = $1, apellido_paterno = $2, apellido_materno = $3,
          fecha_nacimiento = $4, correo_electronico = $5, numero_celular = $6,
          genero = $7, direccion = $8
      WHERE id = $9
    `;
    const values = [
      data.nombres, data.apellido_paterno, data.apellido_materno,
      data.fecha_nacimiento, data.correo_electronico, data.numero_celular,
      data.genero, data.direccion, id
    ];
    await client.query(query, values);
  }

  async createMatricula(estudiante_id, observaciones_medicas, client = db) {
    const query = `
      INSERT INTO matriculas (estudiante_id, observaciones_medicas)
      VALUES ($1, $2)
      RETURNING id
    `;
    const result = await client.query(query, [estudiante_id, observaciones_medicas]);
    return result.rows[0].id;
  }

  async addDisciplinasAMatricula(matricula_id, disciplinasIds, client = db) {
    // Generar consulta para inserción múltiple
    const values = [];
    const placeholders = [];
    let paramIndex = 1;

    for (const disciplina_id of disciplinasIds) {
      placeholders.push(`($${paramIndex++}, $${paramIndex++})`);
      values.push(matricula_id, disciplina_id);
    }

    const query = `
      INSERT INTO matricula_disciplinas (matricula_id, disciplina_id)
      VALUES ${placeholders.join(', ')}
    `;
    
    await client.query(query, values);
  }
}

module.exports = new MatriculasRepository();
