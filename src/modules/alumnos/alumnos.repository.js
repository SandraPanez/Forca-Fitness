// const db = require('../../config/db'); // TODO: Descomentar cuando AWS esté disponible

const alumnosMock = [
  {
    id: 1,
    nombres: 'Juan',
    apellido_paterno: 'Rondón',
    apellido_materno: 'Pujay',
    numero_documento: '74628153',
    fecha_nacimiento: '2000-05-15',
    correo_electronico: 'juan.rondon.pujay@gmail.com',
    numero_celular: '987654321',
    disciplinas: 'Capoeira, MMA',
    observaciones_medicas: 'Ninguna',
    fecha_matricula: '2026-09-10'
  },
  {
    id: 2,
    nombres: 'Fernando',
    apellido_paterno: 'Lezama',
    apellido_materno: 'Rodriguez',
    numero_documento: '87654321',
    fecha_nacimiento: '1998-03-22',
    correo_electronico: 'fernando.lezama@gmail.com',
    numero_celular: '956784321',
    disciplinas: 'Box',
    observaciones_medicas: 'Ninguna',
    fecha_matricula: '2026-07-01'
  }
];

class AlumnosRepository {
  async findAllAlumnos() {
    // TODO: Reemplazar con query real cuando AWS esté disponible
    // const query = `
    //   SELECT e.id, e.nombres, e.apellido_paterno, e.apellido_materno,
    //          m.fecha_matricula, m.estado
    //   FROM estudiantes e
    //   JOIN matriculas m ON e.id = m.estudiante_id
    //   ORDER BY e.nombres ASC
    // `;
    // const result = await db.query(query);
    // return result.rows;
    return alumnosMock;
  }

  async findAlumnoById(id) {
    // TODO: Reemplazar con query real cuando AWS esté disponible
    // const query = `...`;
    // const result = await db.query(query, [id]);
    // return result.rows[0] || null;
    return alumnosMock.find(a => a.id === parseInt(id)) || null;
  }
}

module.exports = new AlumnosRepository();
