const { tienePermiso } = require('../constants/permisos');

function autorizar(permiso) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: 'Usuario no autenticado'
      });
    }

    if (!tienePermiso(req.user.roles, permiso)) {
      return res.status(403).json({
        message: 'No tiene permisos para realizar esta acción'
      });
    }

    return next();
  };
}

module.exports = {
  autorizar
};