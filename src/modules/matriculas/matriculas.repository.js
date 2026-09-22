const db = require('../../shared/config/database');

class MatriculasRepository {
  async getDisciplinas() {
    const result = await db.query('SELECT id, nombre, descripcion FROM disciplinas ORDER BY id ASC');
    return result.rows;
  }
}

module.exports = new MatriculasRepository();
