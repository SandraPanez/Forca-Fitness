const alumnosRoutes = require('./alumnos/alumnos.routes');
const matriculasRoutes = require('./matriculas/matriculas.routes');
const authRoutes = require('./auth/auth.routes');
const pagosRoutes = require('./pagos/pagos.routes');
const comprobantesRoutes = require('./comprobantes/comprobantes.routes');
const profesoresRoutes = require('./profesores/profesores.routes');

module.exports = {
  alumnosRoutes,
  matriculasRoutes,
  profesoresRoutes,
  authRoutes,
  pagosRoutes,
  comprobantesRoutes
};
