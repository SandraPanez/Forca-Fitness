const alumnosRoutes = require('./alumnos/alumnos.routes');
const matriculasRoutes = require('./matriculas/matriculas.routes');
const authRoutes = require('./auth/auth.routes');
const pagosRoutes = require('./pagos/pagos.routes');
const comprobantesRoutes = require('./comprobantes/comprobantes.routes');

module.exports = {
  alumnosRoutes,
  matriculasRoutes,
  authRoutes,
  pagosRoutes,
  comprobantesRoutes
};
