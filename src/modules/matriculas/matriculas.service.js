const matriculasRepository = require('./matriculas.repository');
const db = require('../../shared/config/database');

class MatriculasService {
  async getDisciplinasDisponibles() {
    return await matriculasRepository.getDisciplinas();
  }
}

module.exports = new MatriculasService();
